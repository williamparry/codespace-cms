import componentLoader, { getAttrs } from "./component-loader.js";

window.onload = async () => {
	let isDirty = false;
	const csrfToken = document.querySelector('meta[name="csrf-token"]').getAttribute('content')
	const elementsToDelete = [];

	// TODO: Make this more isolated so that it doesn't need to reference outside vars
	window.customElements.define(
		"top-bar",
		class extends HTMLElement {
			constructor() {
				super();
				let shadowRoot = this.attachShadow({ mode: "open" });
				const tmpl = document.createElement("template");
				tmpl.innerHTML = `
				<select id="pages-list"></select>
				<button id="save-content" class="cms-toolbar-button">Save</button>
				<button id="duplicate-page" class="cms-toolbar-button">Duplicate Page</button>
				<button id="view-page" class="cms-toolbar-button">View Page</button>
				<button id="page-head" class="cms-toolbar-button">Page Configuration`;

				shadowRoot.appendChild(tmpl.content.cloneNode(true));

				const $saveContent = shadowRoot.getElementById("save-content");
				const $pagesList = shadowRoot.getElementById("pages-list");
				const $viewPage = shadowRoot.getElementById("view-page");
				const $duplicatePage = shadowRoot.getElementById("duplicate-page");

				const currentFile = window.location.pathname.split("/cms/")[1];

				const link = document.createElement("link");

				link.href = "/cms/components.css";
				link.rel = "stylesheet";

				shadowRoot.appendChild(link);

				const saveContent = async () => {
					const editableComponents = Array.from(
						document.querySelectorAll(window.registeredCustomElements.join(","))
					)
						.filter((f) => f.id)
						.map((f) => {
							let attributes = getAttrs(f.attributes);
							delete attributes.id;
							return {
								id: f.id,
								attributes,
							};
						});
					const contentEditableComponents = Array.from(document.querySelectorAll("[contenteditable]"))
						.filter((f) => f.id)
						.map((el) => {
							const toSaveEl = el.cloneNode(true);

							return {
								id: toSaveEl.id,
								html: toSaveEl.innerHTML,
							};
						});

					let cloned = {};
					Array.from(document.querySelectorAll("[data-cloned]"))
						.map((el) => {
							let pos = 0;
							let currentEl = el;

							while (currentEl.previousElementSibling.id !== currentEl.dataset.clonedfrom) {
								pos++;
								currentEl = currentEl.previousElementSibling;
							}

							const toSaveEl = el.cloneNode(true);

							const clonedFrom = toSaveEl.dataset.clonedfrom;
							delete toSaveEl.dataset.cloned;
							delete toSaveEl.dataset.clonedfrom;

							window.registeredCustomElements.forEach((r) => {
								const innerComponents = Array.from(toSaveEl.querySelectorAll(r));
								if (innerComponents.length > 0) {
									innerComponents.forEach((c) => {
										c.innerHTML = "";
									});
								}
							});

							return {
								pos,
								clonedFrom,
								html: toSaveEl.outerHTML,
							};
						})
						.sort((a, b) => a.pos - b.pos)
						.forEach((p) => {
							if (!cloned[p.clonedFrom]) {
								cloned[p.clonedFrom] = [];
							}
							cloned[p.clonedFrom].push(p.html);
						});
					const payload = {
						editableComponents,
						contentEditableComponents,
						cloned,
						elementsToDelete,
					};

					await fetch(`/cms/${currentFile}`, {
						method: "POST",
						mode: "same-origin",
						credentials: "same-origin",
						cache: "no-cache",
						headers: {
							"CSRF-Token": csrfToken,
							"Content-Type": "application/json",
						},
						referrerPolicy: "no-referrer",
						body: JSON.stringify(payload),
					})
						.then((response) => {
							if (!response.ok) {
								throw Error(response.statusText);
							}
							return response;
						})
						.then(() => {
							setIsDirty(false);
						})
						.catch(() => {
							alert("Save Failed");
						});
				};

				$saveContent.onclick = async () => {
					await saveContent();
				};

				PAGE_DATA.pagesList.forEach((page) => {
					const option = document.createElement("option");
					option.value = page;
					option.text = page;
					$pagesList.appendChild(option);
				});

				$pagesList.value = currentFile;

				$pagesList.onchange = () => {
					window.location.href = "/cms/" + $pagesList.value;
				};

				$viewPage.onclick = async () => {
					if (isDirty) {
						if (confirm("There are unsaved changes. Save first?")) {
							await saveContent();
						}
					}
					window.open("/view/" + currentFile);
				};

				$duplicatePage.onclick = async () => {
					const newFileName = prompt("New File Name?", currentFile);
					if (currentFile === newFileName) {
						alert("Cannot use the same file path");
					} else if (!newFileName) {
						alert("Please insert a file path");
					} else {
						fetch(`/cms/`, {
							method: "POST",
							mode: "same-origin",
							credentials: "same-origin",
							cache: "no-cache",
							headers: {
								"CSRF-Token": csrfToken,
								"Content-Type": "application/json",
							},
							referrerPolicy: "no-referrer",
							body: JSON.stringify({
								currentFile,
								newFileName,
							}),
						})
							.then((response) => {
								if (!response.ok) {
									throw Error(response.statusText);
								}
								return response;
							})
							.then(() => {
								window.location.href = "/cms/" + newFileName;
							})
							.catch(() => {
								alert("Save Failed");
							});
					}
				};
			}
		}
	);

	const $pageHTML = document.getElementById("page-html");
	const $topBar = document.getElementById("top-bar").shadowRoot;
	const $saveContent = $topBar.getElementById("save-content");
	const saveContentText = $saveContent.textContent;

	const setIsDirty = (dirty) => {
		isDirty = true;
		$saveContent.textContent = dirty ? `${saveContentText}*` : saveContentText;
		window.onbeforeunload = dirty ? () => "You have unsaved changes" : null;
	};

	await componentLoader(PAGE_DATA.components, false, $topBar.getElementById("page-head"));

	document.body.onclick = (e) => {
		if (e.target.classList.contains("cms-clone-button")) {
			e.stopPropagation();
			const $el = toolbars[e.target.parentNode.dataset.refId].$el;

			const node = $el.cloneNode(true);

			node.dataset.cloned = true;
			node.dataset.clonedfrom = $el.dataset.clonedfrom || $el.id;
			[node, ...node.querySelectorAll(`[id]`)].forEach((el) => {
				el.id = el.id + "-" + Math.floor(Math.random() * 999);
			});
			const newHTML = node.outerHTML;
			$el.insertAdjacentHTML("afterend", newHTML);
		} else if (e.target.classList.contains("cms-delete-button")) {
			if (confirm("Are you sure you want to delete this section?")) {
				const $el = toolbars[e.target.parentNode.dataset.refId].$el;
				if (!$el.dataset.cloned) {
					elementsToDelete.push($el.id);
				}
				$el.remove();
			}
		}
	};

	function formatDoc($el, sCmd, sValue) {
		$el.focus();
		document.execCommand(sCmd, false, sValue);
	}

	const toolbars = {};

	const refreshActiveToolbars = () => {
		Array.from(document.querySelectorAll("[contenteditable],[data-cloneable]")).forEach(($el) => {
			if (!toolbars[$el.id]) {
				const $toolbar = document.createElement("div");
				$toolbar.classList.add("cms-toolbar");
				$toolbar.dataset.refId = $el.id;
				toolbars[$el.id] = {
					$el,
					$toolbar,
				};
				document.body.appendChild($toolbar);
				$toolbar.style.position = "absolute";
				$el.onmouseover = $el.onfocus = () => {
					$toolbar.classList.add("active");
				};
				$el.onmouseleave = $el.onblur = () => {
					$toolbar.classList.remove("active");
				};

				if ($el.hasAttribute("contenteditable")) {
					const addElementList = $el.dataset.toolbar;
					const allItems = ["insertorderedlist", "insertunorderedlist", "createlink"];

					if (addElementList) {
						addElementList
							.split(",")
							.filter((t) => {
								// Only have allowed items
								return allItems.indexOf(t) !== -1;
							})
							.forEach((t) => {
								const r = document.createElement("component-button");
								const textNode = document.createElement("span");
								const icon = document.createElement("img");
								switch (t) {
									case "insertorderedlist":
										textNode.textContent = "Number List";
										icon.src =
											"data:image/gif;base64,R0lGODlhFgAWAMIGAAAAADljwliE35GjuaezxtHa7P///////yH5BAEAAAcALAAAAAAWABYAAAM2eLrc/jDKSespwjoRFvggCBUBoTFBeq6QIAysQnRHaEOzyaZ07Lu9lUBnC0UGQU1K52s6n5oEADs=";

										r.appendChild(icon);
										r.appendChild(textNode);
										r.onclick = () => {
											formatDoc($el, t);
										};
										break;
									case "insertunorderedlist":
										textNode.textContent = "Bullet List";
										icon.src =
											"data:image/gif;base64,R0lGODlhFgAWAMIGAAAAAB1ChF9vj1iE33mOrqezxv///////yH5BAEAAAcALAAAAAAWABYAAAMyeLrc/jDKSesppNhGRlBAKIZRERBbqm6YtnbfMY7lud64UwiuKnigGQliQuWOyKQykgAAOw==";
										r.appendChild(icon);
										r.appendChild(textNode);
										r.onclick = () => {
											formatDoc($el, t);
										};
										break;
									case "createlink":
										textNode.textContent = "Link";
										icon.src =
											"data:image/gif;base64,R0lGODlhFgAWAOMKAB1ChDRLY19vj3mOrpGjuaezxrCztb/I19Ha7Pv8/f///////////////////////yH5BAEKAA8ALAAAAAAWABYAAARY8MlJq7046827/2BYIQVhHg9pEgVGIklyDEUBy/RlE4FQF4dCj2AQXAiJQDCWQCAEBwIioEMQBgSAFhDAGghGi9XgHAhMNoSZgJkJei33UESv2+/4vD4TAQA7";
										r.appendChild(icon);
										r.appendChild(textNode);
										r.onclick = () => {
											const sel = window.getSelection();

											if (sel.rangeCount === 0) {
												alert("Please select something to link");
												return;
											}

											// TODO: Put into web component
											const $dialogEl = document.createElement("dialog");

											const $select = document.createElement("select");
											const $selectOption = document.createElement("option");
											$selectOption.value = "";
											$selectOption.textContent = "- Select -";
											$select.appendChild($selectOption);

											PAGE_DATA.pagesList.forEach((page) => {
												const option = document.createElement("option");
												option.value = page;
												option.text = page;
												$select.appendChild(option);
											});

											// TODO:
											// const range = sel.getRangeAt(0);
											// const existingTag = range.startContainer.parentNode;
											// if (existingTag && PAGE_DATA.pagesList.indexOf(existingTag.href) !== -1) {
											// 	$select.value = existingTag.href;
											// }

											$dialogEl.appendChild($select);

											const linkSubmit = document.createElement("button");
											linkSubmit.innerText = "Submit";
											$dialogEl.appendChild(linkSubmit);

											const linkCancel = document.createElement("button");
											linkCancel.innerText = "Cancel";
											$dialogEl.appendChild(linkCancel);

											linkCancel.onclick = () => {
												$dialogEl.close();
											};

											linkSubmit.onclick = () => {
												const val = $select.value;
												if (val === "") {
													alert("Please select a link");
												} else {
													$dialogEl.close();

													formatDoc($el, "createlink", val);
												}
											};

											document.body.appendChild($dialogEl);

											$dialogEl.onclose = () => {
												$dialogEl.remove();
											};

											$dialogEl.showModal();
										};
										break;
								}
								if (r.textContent) {
									$toolbar.appendChild(r);
								}
							});
					}
				}

				if (typeof $el.dataset.cloneable !== "undefined") {
					const appendButton = document.createElement("component-button");
					appendButton.textContent = "Clone";
					appendButton.classList.add("cms-clone-button");
					appendButton.dataset.cloneid = $el.id;
					$toolbar.appendChild(appendButton);

					const deleteButton = document.createElement("component-button");
					deleteButton.textContent = "Delete";
					deleteButton.classList.add("cms-delete-button");
					$toolbar.appendChild(deleteButton);
				}
			}
		});
		refreshToolbarPositions();
	};

	const refreshToolbarPositions = () => {
		for (const toolbar of Object.values(toolbars)) {
			toolbar.$toolbar.style.top = toolbar.$el.offsetTop + "px";
			toolbar.$toolbar.style.left = toolbar.$el.offsetLeft + "px";
		}
	};

	const config = { attributes: true, childList: true, subtree: true, characterData: true };

	const registeredForDOMChanges = PAGE_DATA.components
		.filter((p) => window.serverScripts[p.ServerScript] && window.serverScripts[p.ServerScript].listenToDOMUpdates)
		.map((p) => ({
			fileNameAsTag: p.FileNameAsTag,
			ClientScript: p.ClientScript ? p.ClientScript.fileName : null,
		}));

	let isReRendering = false;
	const callback = async function () {
		setIsDirty(true);

		if (isReRendering) {
			return;
		}
		if (!isReRendering) {
			isReRendering = true;
			for (const c of registeredForDOMChanges) {
				const instances = [...document.querySelectorAll(c.fileNameAsTag)];
				for (const instance of instances) {
					await instance.render();
				}
			}
			isReRendering = false;
		}
		setTimeout(() => {
			refreshActiveToolbars();
		}, 50);
	};

	const observer = new MutationObserver(callback);

	observer.observe($pageHTML, config);

	window.onresize = () => {
		refreshToolbarPositions();
	};

	// Bit hacky to make sure page has settled its position
	// TODO: Could look at a hook for rendering
	setTimeout(() => {
		refreshActiveToolbars();
	}, 500);
};
