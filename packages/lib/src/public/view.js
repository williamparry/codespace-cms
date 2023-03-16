import componentLoader from "./component-loader.js";

window.onload = async () => {
	await componentLoader(PAGE_DATA.components, true);
	const toClear = document.querySelectorAll(".clear");
	Array.from(toClear).forEach((f) => {
		f.remove();
	});
	const contenteditable = document.querySelectorAll("[contenteditable]");
	Array.from(contenteditable).forEach((f) => {
		f.removeAttribute("contenteditable");
	});

	const cloneable = document.querySelectorAll("[data-cloneable]");
	Array.from(cloneable).forEach((f) => {
		f.removeAttribute("data-cloneable");
	});

	const toolbar = document.querySelectorAll("[data-toolbar]");
	Array.from(toolbar).forEach((f) => {
		f.removeAttribute("data-toolbar");
	});

	PAGE_DATA.components
		.map((p) => p.FileNameAsTag)
		.forEach((r) => {
			Array.from(document.querySelectorAll(`${r}, #cms-template-${r}`)).forEach((el) => {
				el.remove();
			});
		});

	window.readytorender = true;

	if (window.location.href.indexOf("cms_render") === -1) {
		Object.keys(window.components).forEach(c => {
			window.components[c]()
		})
	}
};
