function GetPosts(rootEl) {
	const c = document.createElement("span");
	c.innerHTML = "Total posts on-this-page: " + Array.from(rootEl.querySelectorAll(".posts ul li")).length;
	rootEl.appendChild(c);
}
