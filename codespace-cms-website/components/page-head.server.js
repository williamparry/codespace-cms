class PageHead {
	static schema = {
		properties: {
			title: {
				type: "string",
			},
			stylesheets: {
				description: "Stylesheets for the page",
				type: "array",
				items: {
					type: "string",
				},
				default: [],
			},
			externalscripts: {
				description: "Scripts for current page",
				type: "array",
				items: {
					type: "string",
				},
				default: [],
			},
		},
	};
	static async render(rootEl, { stylesheets, externalscripts, title }) {
		title = "codespace-cms" + (title ? " : " + title : "");
		document.title = title;
		rootEl.querySelector("title").textContent = title;
		stylesheets.forEach((s) => {
			const link = document.createElement("link");
			link.rel = "stylesheet";
			link.href = s;
			rootEl.appendChild(link);
		});
		externalscripts.forEach((s) => {
			const script = document.createElement("script");
			script.src = s;
			rootEl.appendChild(script);
		});
	}
}
