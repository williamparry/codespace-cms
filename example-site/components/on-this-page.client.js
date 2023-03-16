function OnThisPage(rootEl) {
	const c = document.createElement("span");
	c.innerHTML = "Total on-this-page: " + Array.from(rootEl.querySelectorAll("nav li")).length;
	rootEl.appendChild(c);
}
