class OnThisPage {
	static listenToDOMUpdates = true;

	static async render(rootEl) {
		const allPageHeadings = [...document.querySelectorAll(".content-section")];
		const nav = rootEl.querySelector(".on-this-page-list");

		allPageHeadings
			.filter((contentSection) => contentSection.id)
			.forEach((contentSection) => {
				const li = document.createElement("li");
				const a = document.createElement("a");

				a.href = "#" + contentSection.id;
				a.textContent = contentSection.querySelector("h2").textContent;
				li.appendChild(a);
				nav.appendChild(li);
			});
	}
}
