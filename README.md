# codespace-cms

A light filesystem-orientated CMS for GitHub Codespaces that uses Puppeteer to generate static HTML pages into a dist folder.

![System diagram](node-static-cms-diagram.png)

Changes are saved back to your `siteRoot` directory. You can modify the pages in the `siteRoot` directory and those changes will be reflected in the CMS, and vica versa.

You can use Git for versioning, and the `outputRoot` folder that gets generated to deploy to a static server somewhere (you'll want to add the `outputRoot` folder to your `.gitignore` file).

![Screenshot](screenshot.png)

## Using the CMS in a Codespace

    npx @williamparry/codespace-cms --siteRoot=(example-site)

You can commit and push the files it changes from VS Code.

## Generating the dist

For GitHub pages put this in as the command:

    sudo apt update && sudo apt-get install chromium -y
    npx @williamparry/codespace-cms --siteRoot=(example-site) --outputRoot=(dist) --generate

To run in your devcontainer, amend your `.devcontainer.json` file:

    "postCreateCommand": "sudo apt update && sudo apt-get install chromium -y"

This will ensure that if you recreate your devcontainer it will automatically download Chromium again. Run the command manually to download now.

## Using locally

⚠ Not advised for security reasons.

    npx @williamparry/codespace-cms --siteRoot=(example-site) --outputRoot=(dist) --users.(admin)=(nodestaticcms)

## Development

### Installing and running

    npm install
    npm run dev (runs on localhost:3000/cms/index.html)

To generate:

    sudo apt update && sudo apt-get install chromium -y # Only needed the first time
    npm run dev:generate (generates pages into dist/)

## Features

- Write straight to the src HTML (use Git for saving versions)
- Easy-to-make components with HTML + server-side JS and client-side JS
- In-place editing, giving you control as to what you'll allow an editor to touch

There is basic auth available out-the-box, but you should use a codespace.

### Does not have

- Image uploading, until it can be done properly

## Structure

You shouldn't need to touch the `lib` folder but I do encourage you to read it.

```
site structure:
    content-pages       (Pages go here)
    components          (Components go here)
    site-assets         (Static assets go here)
```

## Components

See: [examples](packages/test/example-site/components)

- Must have a `.html` file
- Can have a `.server.js` file that will render statically when generating
- Can have a `.client.js` file that will run on the page like normal

## Pages

See: [examples](packages/test/example-site/content-pages)

- Must have a `<page-head>`
- Can use components that are made in the `components` directory automatically
- Any element that is content managed must have an `id`

## Globals

You can reference the `PAGE_DATA` object in your `.server.js` files to e.g. iterate through the pages list.

The `PAGE_DATA` object is not printed in the final output, so it won't work for `.client.js` files.

| Property               | Type                                                                                         | Description                                                                     |
| ---------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `PAGE_DATA.components` | `Array<{FileNameAsTag: string, ServerScript: string \| null, ClientScript: string \| null}>` | `[{"FileNameAsTag":"file-name","ServerScript":"FileName","ClientScript":null}]` |
| `PAGE_DATA.pagesList`  | `Array<string>`                                                                              | Relative paths of pages from `src/content-pages`                                |
| `PAGE_DATA.siteAssets` | `Array<string>`                                                                              | Absolute paths of assets from `src/site-assets`                                 |
