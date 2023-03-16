class GetPosts {
	static schema = {
		properties: {
			showsnippet: {
				type: "boolean",
				default: true,
			},
			directory: {
				type: "string",
				enumSource: [
					Array.from(
						new Set(
							PAGE_DATA.pagesList
								.filter((p) => p.includes("/"))
								.map((p) => {
									const pArr = p.split("/");
									pArr.pop();
									return pArr.join("/");
								})
						)
					),
				], // This is not great code
			},
		},
		required: ["showsnippet", "directory"],
	};

	static async render(rootEl, { showsnippet, directory }) {
		if (directory) {
			const files = PAGE_DATA.pagesList.filter((p) => p.startsWith(directory));
			const $postsList = rootEl.querySelector(".posts ul");

			for (const file of files) {
				await fetch("/view/" + file)
					.then(function (response) {
						return response.text();
					})
					.then(function (html) {
						// Convert the HTML string into a document object
						var parser = new DOMParser();
						var doc = parser.parseFromString(html, "text/html");

						const pageTitle = doc.querySelector("page-head").getAttribute("title");

						const $li = document.createElement("li");
						const $a = document.createElement("a");
						const $p = document.createElement("p");

						$a.href = file;
						$a.textContent = pageTitle;

						$li.appendChild($a);

						if (showsnippet) {
							const $snippetEl = doc.querySelector(".post-content");
							if ($snippetEl) {
								$p.innerText = $snippetEl.textContent;
								$li.appendChild($p);
							}
						}

						$postsList.appendChild($li);
					})
					.catch(function (err) {
						console.warn("Something went wrong.", err);
					});
			}
		}
	}
}
