class PageHead {
	static schema = {
		properties: {
			title: {
				type: "string",
			},
			stylesheets: {
				description: "The current page",
				type: "array",
				items: {
					type: "string",
				},
				default: [],
			},
		},
	};
	static async render(rootEl, { stylesheets, title }) {
		title = "node-cms" + (title ? " : " + title : "");
		document.title = title;
		rootEl.querySelector("title").textContent = title;
		stylesheets.forEach((s) => {
			const link = document.createElement("link");
			link.rel = "stylesheet";
			link.href = s;
			rootEl.appendChild(link);
		});
	}
}
