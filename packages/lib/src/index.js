const express = require("express");
const fs = require("fs-extra");
const klawSync = require("klaw-sync");
const path = require("path");
const cheerio = require("cheerio");
const bodyParser = require("body-parser");
const puppeteer = require("puppeteer");
const prettier = require("prettier");
const helmet = require("helmet");
const csrf = require("csurf");
const cookieParser = require("cookie-parser");
const { expressCspHeader, NONCE } = require("express-csp-header");

const checkFilePath = (filePath) => {
	return !(!filePath || filePath.includes("..") || !filePath.endsWith(".html"));
};

module.exports.checkFilePath = checkFilePath;

module.exports.cms = (argv) => {
	const port = argv.port || 3000;
	const app = express();
	const csrfProtection = csrf({ cookie: true });
	app.use(helmet());
	app.use(cookieParser());

	app.use(
		expressCspHeader({
			directives: {
				"script-src": [NONCE, 'https://cdnjs.cloudflare.com'], // TODO: Make sources configurable?
			},
		})
	);

	let basicAuthUsers;

	if (!argv.siteRoot) {
		console.log(`Site root "${siteRoot}" not passed in (--siteRoot=)`);
		return;
	}

	if (argv.generate && !argv.outputRoot) {
		console.log(`Output root "${outputRoot}" not passed in (--outputRoot=)`);
		return;
	}

	if (argv.users) {
		try {
			if (typeof argv.users !== "object") {
				throw new Error("Running without basic auth: (--users) is malformed");
			}
			basicAuthUsers = argv.users;
			const basicAuth = require("express-basic-auth");
			app.use(
				basicAuth({
					users: basicAuthUsers,
					challenge: true,
				})
			);
		} catch (ex) {
			console.log(ex);
		}
	}

	const AuthTypes = {
		basic: "Basic Auth",
		codespace: "Codespace Auth",
		none: "No Auth"
	}

	const authType = argv.intest ? AuthTypes.basic : (basicAuthUsers && !process.env.CODESPACES) ? AuthTypes.basic : process.env.CODESPACES ? AuthTypes.codespace : AuthTypes.none;

	const CWD = process.cwd();

	const BASE_DIR = path.join(CWD, argv.siteRoot);
	const DIST_DIR = argv.outputRoot ? path.join(CWD, argv.outputRoot) : "Not defined";

	if (!fs.existsSync(BASE_DIR)) {
		console.log(`Source directory "${BASE_DIR}" does not exist`);
		return;
	}

	const SITE_ASSETS_DIR = path.join(BASE_DIR, "site-assets");
	const COMPONENTS_DIR = path.join(BASE_DIR, "components");
	const PAGES_DIR = path.join(BASE_DIR, "content-pages");

	const mainDirs = { SITE_ASSETS_DIR, COMPONENTS_DIR, PAGES_DIR };

	for (const [key, value] of Object.entries(mainDirs)) {
		if (!fs.existsSync(value)) {
			console.log(`"${key}" does not exist`);
			return;
		}
	}

	const PRETTIER_PATH = path.join(BASE_DIR, ".prettierrc");
	let prettierOptions = {};
	if (fs.existsSync(PRETTIER_PATH)) {
		prettierOptions = JSON.parse(fs.readFileSync(PRETTIER_PATH).toString());
	}

	app.set("view engine", "ejs");
	app.set("views", path.join(__dirname, "/views"));
	app.use(bodyParser.json());
	["public"].forEach((staticDir) => {
		app.use("/cms", express.static(path.join(__dirname, staticDir)));
		app.use("/view", express.static(path.join(__dirname, staticDir)));
	});

	app.use(express.static(SITE_ASSETS_DIR));

	function clearAndUpper(text) {
		return text.replace(/-/, "").toUpperCase();
	}

	function toPascalCase(text) {
		return text.replace(/(^\w|-\w)/g, clearAndUpper);
	}

	const getComponents = () => {
		const allFiles = fs.readdirSync(COMPONENTS_DIR);
		const allHTML = [];
		const allJS = [];
		const clientJS = [];
		allFiles.forEach((f) => {
			const fileName = path.parse(f).name.split(".")[0];
			if (f.endsWith(".html")) {
				allHTML.push(fileName);
			} else if (f.endsWith(".server.js")) {
				allJS.push(fileName);
			} else if (f.endsWith(".client.js")) {
				clientJS.push(fileName);
			}
		});

		return allHTML.map((f) => {
			return {
				FileNameAsTag: f,
				HTML: fs.readFileSync(path.join(COMPONENTS_DIR, f + ".html")).toString(),
				ServerScript: allJS.find((j) => j === f)
					? {
							fileName: toPascalCase(f),
							contents: fs.readFileSync(path.join(COMPONENTS_DIR, f + ".server.js")).toString(),
					  }
					: null,
				ClientScript: clientJS.find((j) => j === f)
					? {
							fileName: toPascalCase(f),
							componentElement: f,
							contents: fs.readFileSync(path.join(COMPONENTS_DIR, f + ".client.js")).toString(),
					  }
					: null,
			};
		});
	};

	const getSiteAssets = () => {
		return klawSync(SITE_ASSETS_DIR)
			.filter((f) => !f.stats.isDirectory())
			.map((f) => "/" + path.relative(SITE_ASSETS_DIR, f.path));
	};

	const getPageHTML = (relativeFilePath) => {
		return fs
			.readFileSync(path.join(PAGES_DIR, relativeFilePath).replace(new RegExp("\\" + path.sep, "g"), "/"))
			.toString();
	};

	const getPagesList = () => {
		return klawSync(PAGES_DIR)
			.filter((f) => f.path.endsWith(".html"))
			.map((f) => path.relative(PAGES_DIR, f.path).replace(new RegExp("\\" + path.sep, "g"), "/"));
	};

	const savePageHTML = (relativeFilePath, html) => {
		fs.writeFileSync(path.join(PAGES_DIR, relativeFilePath), html);
	};

	function relativeHTMLFilePathHandler(req, res, next) {
		const fullPath = req.params.relativeDirPath
			? req.params.relativeDirPath + req.params.relativeFilePath
			: req.params.relativeFilePath;

		const relativeFilePath = fullPath + ".html";

		if (checkFilePath(relativeFilePath)) {
			const pageHTML = getPageHTML(relativeFilePath);
			req.relativeFilePath = relativeFilePath;
			req.pageHTML = pageHTML;
			next();
		} else {
			console.log("Path", `"${fullPath}"`, "includes ..");
			res.status(500).send("Error");
		}
	}

	app.post("/cms", csrfProtection, (req, res) => {
		if (checkFilePath(req.body.currentFile) && checkFilePath(req.body.newFileName)) {
			if (fs.existsSync(path.join(PAGES_DIR, req.body.newFileName))) {
				console.log("Path", req.body.newFileName, "already exists");
				res.status(500).send("Error");
			} else {
				fs.copyFileSync(path.join(PAGES_DIR, req.body.currentFile), path.join(PAGES_DIR, req.body.newFileName));
				res.status(200).send("OK");
			}
		} else {
			console.log("Paths", req.body.currentFile, req.body.newFileName, "include ..");
			res.status(500).send("Error");
		}
	});

	const addNonceToHTMLScriptElements = (HTML, nonce) => {
		const $ = cheerio.load(HTML, {
			_useHtmlParser2: true,
		});

		$("script").each((i, script) => {
			if (script.attribs.src.startsWith("/")) {
				$(script).attr("nonce", nonce);
			}
		});

		return $.html();
	};

	const removeNonceFromHTMLScriptElements = (HTML) => {
		const $ = cheerio.load(HTML, {
			_useHtmlParser2: true,
		});

		$("script[nonce]").each((i, script) => {
			if (script.attribs.src && script.attribs.src.startsWith("/")) {
				$(script).removeAttr("nonce");
			}
		});

		return $.html();
	};

	const addComponentsScript = (HTML) => {
		const $ = cheerio.load(HTML, {
			_useHtmlParser2: true,
		});

		$("head").append(`<script src="/js/components.js"></script>`);

		return $.html();
	};

	app.get("/", (_req, res) => {
		const allPages = getPagesList();
		if(allPages.indexOf("index.html") !== -1) {
			res.redirect(302, "/cms/index.html");
		} else {
			res.send("<pre>No index.html file found at the root of content-pages. Go to /cms/{page}</pre>")
		}
	});

	app.get(
		["/cms/:relativeFilePath.html", "/cms/:relativeDirPath(*/):relativeFilePath.html"],
		csrfProtection,
		relativeHTMLFilePathHandler,
		(req, res) => {
			const components = getComponents().map((c) => {
				c.HTML = addNonceToHTMLScriptElements(c.HTML, req.nonce);
				return c;
			});
			const siteAssets = getSiteAssets();
			const pagesList = getPagesList();

			res.render("index", {
				nonce: req.nonce,
				csrfToken: req.csrfToken(),
				pageHTML: addNonceToHTMLScriptElements(req.pageHTML, req.nonce),
				pagesList,
				components,
				siteAssets,
			});
		}
	);

	app.post(
		["/cms/:relativeFilePath.html", "/cms/:relativeDirPath(*/):relativeFilePath.html"],
		csrfProtection,
		relativeHTMLFilePathHandler,
		(req, res) => {
			const $ = cheerio.load(req.pageHTML, {
				_useHtmlParser2: true,
			});

			req.body.contentEditableComponents.forEach((p) => {
				$("#" + p.id).html(p.html);
			});
			req.body.editableComponents.forEach((p) => {
				const $el = $("#" + p.id);
				Object.keys(p.attributes).forEach((attr) => {
					$el.attr(attr, p.attributes[attr]);
				});
			});

			Object.keys(req.body.cloned).forEach((p) => {
				const $el = $("#" + p);
				const toAppend = req.body.cloned[p];
				toAppend.reverse().forEach((a) => {
					$el.after(a);
				});
			});

			req.body.elementsToDelete.forEach((p) => {
				const $el = $("#" + p);
				$el.remove();
			});

			// Cheerio adds <head></head> unless using _useHtmlParser2
			// https://github.com/cheeriojs/cheerio/issues/1031
			prettier.format($.html(), { ...prettierOptions, parser: "html" }).then(pageHTML => {
				savePageHTML(
					req.relativeFilePath,
					pageHTML
				);
				res.status(200).send("OK");
			}).catch(e => {
				res.status(500)
			})

			
		}
	);

	app.get(
		["/view/:relativeFilePath.html", "/view/:relativeDirPath(*/):relativeFilePath.html"],
		relativeHTMLFilePathHandler,
		(req, res) => {
			const components = getComponents().map((c) => {
				c.HTML = addNonceToHTMLScriptElements(c.HTML, req.nonce);
				return c;
			});
			const pagesList = getPagesList();
			const siteAssets = getSiteAssets();
			prettier.format(addNonceToHTMLScriptElements(req.pageHTML, req.nonce), {
				...prettierOptions,
				parser: "html",
			}).then(pageHTML => {
				res.render("view", {
					nonce: req.nonce,
					pageHTML,
					pagesList,
					components,
					siteAssets,
				});
			})
			
		}
	);

	app.use(function (err, req, res, next) {
		if (err.code !== "EBADCSRFTOKEN") return next(err);
		res.sendStatus(403);
	});
	
	app.listen(port, async () => {
		console.table({
			BASE_DIR,
			SITE_ASSETS_DIR,
			DIST_DIR,
			"Auth Type": authType,
			"Server running at": process.env.CODESPACES ? `https://${process.env.CODESPACE_NAME}-${port}.app.github.dev/` : `http://localhost:${port}`,
			"Generate Mode": argv.generate ? "Yes" : "No",
			"Test Mode": argv.intest ? "Yes" : "No",
		});

		if (argv.generate) {
			try {
				console.log("Generating pages");
				const browser = await puppeteer.launch({
					args: [
						'--no-sandbox',
						'--disable-setuid-sandbox'
					]
				});
				const page = await browser.newPage();

				if (authType == AuthTypes.basic) {
					const basicAuthUserKeys = Object.keys(basicAuthUsers);
					await page.authenticate({
						username: basicAuthUserKeys[0],
						password: basicAuthUsers[basicAuthUserKeys[0]],
					});
				}

				await page.setRequestInterception(true);
				page.on("request", (request) => {
					if (
						["image", "stylesheet", "font", "script"].indexOf(request.resourceType()) !== -1 &&
						!request.url().startsWith(`http://localhost:${port}`)
					) {
						request.abort();
					} else {
						request.continue();
					}
				});

				const pagesList = getPagesList();
				const pagesToWrite = {};

				// TODO: Make parallel
				for (const htmlFilePath of pagesList) {
					const url = `http://localhost:${port}/view/${htmlFilePath}?cms_render`;
					console.log("Process", url);

					await page.goto(url);

					const watchDog = page.waitForFunction("window.readytorender === true");
					await watchDog;
					let bodyHTML = await page.content();

					bodyHTML = addComponentsScript(removeNonceFromHTMLScriptElements(bodyHTML));

					if (bodyHTML.indexOf("PAGE_DATA") !== -1) {
						throw new Error("PAGE_DATA found in output HTML.");
					}
					pagesToWrite[path.join(DIST_DIR, htmlFilePath)] = bodyHTML;
				}

				await browser.close();

				fs.ensureDirSync(DIST_DIR);
				fs.emptyDirSync(DIST_DIR);

				Object.keys(pagesToWrite).forEach((f) => {
					fs.ensureFileSync(f);
					fs.writeFileSync(f, pagesToWrite[f]);
				});

				console.log("Compiling component javascript");

				const components = getComponents();

				const allScripts = components
					.filter((p) => p.ClientScript)
					.map(
						(p) =>
							`${p.ClientScript.fileName}: () => Array.from(document.querySelectorAll('[data-component=${p.FileNameAsTag}]')).forEach(${p.ClientScript.contents})`
					)
					.join(",");

				const scriptTemplate = `window.onload = () => {
					window.components = { ${allScripts} }
					Object.keys(window.components).forEach(c => {
						window.components[c]()
					})
				}`;

				fs.ensureDirSync(path.join(DIST_DIR, "js"));
				fs.writeFileSync(path.join(DIST_DIR, "js", "components.js"), scriptTemplate);

				console.log("Copying site assets");

				fs.copySync(SITE_ASSETS_DIR, DIST_DIR);

				process.exit();
			} catch (ex) {
				console.log(ex);
				process.exit();
			}
		}

		if (argv.intest) {
			console.log("IN_TEST");
		}
	});
};

if (require.main === module) {
	const yargs = require("yargs/yargs");
	const { hideBin } = require("yargs/helpers");
	const argv = yargs(hideBin(process.argv)).argv;
	this.cms(argv);
}
