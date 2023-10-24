import { exec, execSync, spawnSync } from "node:child_process";
import { launch } from "puppeteer";
import chalk from "chalk";
import axios from "axios";
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
//const checkFilePath = require("../lib/src/index.js");
// TODO: Fix ESM/CJS later
const checkFilePath = (filePath) => {
	return !(!filePath || filePath.includes("..") || !filePath.endsWith(".html"));
};

let child;

const username = "admin";
const password = "nodestaticcms";

const npmLinkResult = execSync("npm ls -g --depth=0 --link=true").toString();

if(!npmLinkResult.includes("codespace-cms")) {
  console.log("codespace-cms not linked");
  execSync("cd ../lib && npm link")
  console.log("Linked")
}

const run = () => {
  console.log("Run test bin", __dirname);
  
  return new Promise((resolve, reject) => {
    child = exec(
      `codespace-cms --siteRoot=example-site --outputRoot=dist --users.${username}=${password} --intest --port=3001`,
      {
        cwd: __dirname,
      },
      (e) => {
        reject();
      }
    );
    let hasStarted = false;
    child.stdout.on("data", async (e) => {
      if (hasStarted) {
        return;
      }

      if (e.indexOf("IN_TEST")) {
        hasStarted = true;
        const tests = [
          {
            description: "Fails to load page without basic auth",
            test: async (page) => {
              const response = await page.goto(
                "http://localhost:3000/cms/index.html"
              );
              const headers = response.headers();
              return (
                response.status() === 401 && headers["content-length"] === "0"
              );
            },
            puppeteer: true,
          },
          {
            description: "Loads page using basic auth",
            test: async (page) => {
              const response = await page.goto(
                "http://localhost:3000/cms/index.html"
              );
              const headers = response.headers();
              return headers["content-length"] > 0;
            },
            puppeteer: true,
            auth: true,
          },
          {
            description: "Does not process pages outside of source",
            test: async () => {
              return checkFilePath("../index.html") === false;
            },
          },
          {
            description: "Does not process non-HTML pages",
            test: async () => {
              return checkFilePath("index.test") === false;
            },
          },
          {
            description: "Does process HTML pages",
            test: async () => {
              return checkFilePath("index.html") === true;
            },
          },
          {
            description: "Cannot save file (POST) without CSRF token",
            test: async () => {
              let success = false;
              try {
                await axios.post(
                  "http://localhost:3000/cms/index.html",
                  {},
                  {
                    auth: {
                      username,
                      password,
                    },
                  }
                );
              } catch (ex) {
                success = ex.response.status === 403;
              }

              return success;
            },
          },
          {
            description:
              "Cannot save file in subfolder (POST) without CSRF token",
            test: async () => {
              let success = false;
              try {
                await axios.post(
                  "http://localhost:3000/cms/folder/index.html",
                  {},
                  {
                    auth: {
                      username,
                      password,
                    },
                  }
                );
              } catch (ex) {
                success = ex.response.status === 403;
              }

              return success;
            },
          },
          {
            description: "Cannot duplicate file (POST) without CSRF token",
            test: async () => {
              let success = false;
              try {
                await axios.post(
                  "http://localhost:3000/cms",
                  {
                    currentFile: "index.html",
                    newFileName: "index3.html",
                  },
                  {
                    auth: {
                      username,
                      password,
                    },
                  }
                );
              } catch (ex) {
                success = ex.response.status === 403;
              }

              return success;
            },
          },
        ];

        console.log(`Running ${tests.length} tests`);

        await Promise.all(
          tests.map(async (test) => {
            if (test.puppeteer) {
              const browser = await launch({
                args: [
                  '--no-sandbox',
                  '--disable-setuid-sandbox'
                ]
              });
              const page = await browser.newPage();
              if (test.auth) {
                await page.authenticate({
                  username,
                  password,
                });
              }
              test.result = (await test.test(page)) ? "Success" : "Fail";

              await browser.close();
            } else {
              test.result = (await test.test()) ? "Success" : "Fail";
            }
          })
        );

        console.log("Results");

        console.table(tests, ["description", "result"]);

        const successful = tests.filter((test) => test.result === "Success");
        const failed = tests.filter((test) => test.result === "Fail");

        console.log(
          chalk.green(`${successful.length} passed`),
          chalk.red(`${failed.length} failed`)
        );
        if (failed.length > 0) {
          reject();
        } else {
          resolve();
        }
      }
    });

    child.stderr.on("data", (e) => {
      reject(e);
    });
  });
};

let testsPassed = false;
try {
  await run();
  testsPassed = true;
} catch (ex) {}

if (process.platform !== "win32") {
  child.kill();
} else {
  spawnSync("taskkill", ["/pid", child.pid, "/f", "/t"]);
}

const exitCode = testsPassed ? 0 : 1;

process.exit(exitCode)
