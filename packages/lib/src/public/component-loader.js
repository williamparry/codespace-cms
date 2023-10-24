export const getAttrs = (attrs) => {
	return Object.assign({}, ...Array.from(attrs, ({ name, value }) => ({ [name]: value })));
};

/*
Defining these Web Components means that they don't inherit any page styling
*/

window.customElements.define(
	"component-button",
	// TODO: Further investigate why setting this to HTMLButtonElement (even with { extends: 'button' }) doesn't work
	class extends HTMLElement {
		constructor() {
			super();
		}
		connectedCallback() {
			let shadowRoot = this.attachShadow({ mode: "open" });

			const link = document.createElement("link");

			link.href = "/cms/components.css";
			link.rel = "stylesheet";

			shadowRoot.appendChild(link);

			const attrs = getAttrs(this.attributes);
			const shadowButton = document.createElement("button");
			shadowButton.classList.add("cms-toolbar-button");
			Object.keys(attrs).forEach((a) => {
				shadowButton.setAttribute(a, attrs[a]);
			});
			shadowButton.innerHTML = this.innerHTML;

			shadowRoot.appendChild(shadowButton);
		}
	}
);

window.customElements.define(
	"component-dialog",
	class extends HTMLElement {
		constructor() {
			super();
			let shadowRoot = this.attachShadow({ mode: "open" });
			const dialogEl = document.createElement("dialog");

			this.dialogEl = dialogEl;

			const link = document.createElement("link");

			link.href = "/cms/lib/bootstrap-4.5.2-dist/css/bootstrap.min.css";
			link.rel = "stylesheet";

			shadowRoot.appendChild(link);

			shadowRoot.appendChild(dialogEl);
		}

		setupJSONEditor(startval, schema, callback) {
			const editor = new JSONEditor(this.dialogEl, {
				startval,
				schema,
				theme: "bootstrap4",
			});
			const formSubmit = document.createElement("button");
			formSubmit.className = "btn btn-primary float-right";
			formSubmit.innerText = "Submit";

			this.dialogEl.appendChild(formSubmit);

			const formClose = document.createElement("button");
			formClose.className = "btn btn-danger float-left";
			formClose.innerText = "Cancel";

			this.dialogEl.appendChild(formClose);

			formClose.onclick = () => {
				this.remove();
			};

			formSubmit.onclick = () => {
				const editorValues = editor.getValue();
				callback(editorValues);
				this.remove();
			};
			// TODO: Move into CSS file
			this.dialogEl.style.maxHeight = "80vh";
			this.dialogEl.style.position = "fixed";
			this.dialogEl.style.overflowY = "auto";
		}

		showModal() {
			this.dialogEl.showModal();
		}
		connectedCallback() {}
	}
);

/**
 * Components
 * @typedef {Object} Component
 * @property {string} FileNameAsTag File Name that's used as a tag
 * @property {string} ServerScript Server scripting
 * @property {string} ClientScript Client scripting
 */

/**
 * Set the title with the provided value.
 * @param {Array<Component>} components
 */
export default async (components, inViewMode, pageHeadEl) => {
	window.registeredCustomElements = [];

	components
		.filter((component) => document.querySelectorAll(component.FileNameAsTag).length > 0)
		.map((component) => {
			window.registeredCustomElements.push(component.FileNameAsTag);

			const componentSchema = component.ServerScript && window.serverScripts[component.ServerScript].schema;

			// page-head is a special component
			const isPageHeadComponent = component.FileNameAsTag === "page-head";

			window.customElements.define(
				component.FileNameAsTag,
				class extends HTMLElement {
					constructor() {
						super();
					}

					static get observedAttributes() {
						return componentSchema ? Object.keys(componentSchema.properties) : [];
					}
					
					async render() {
						// fromEntries looks interesting
						// If schema props not in attributes, add
						const initVals = {};
						if (componentSchema) {
							Object.keys(componentSchema.properties).forEach((f) => {
								initVals[f] = componentSchema.properties[f].default || "";
							});
						}
						this.attrs = { ...initVals, ...getAttrs(this.attributes) };

						Object.keys(this.attrs).forEach((f) => {
							if (componentSchema && componentSchema.properties[f]) {
								if (componentSchema.properties[f].type === "array") {
									if (!Array.isArray(this.attrs[f])) {
										this.attrs[f] = this.attrs[f] ? this.attrs[f].split(",") : [];
									}
								} else if (componentSchema.properties[f].type === "object") {
									this.attrs[f] = this.attrs[f] ? JSON.parse(this.attrs[f]) : {};
								} else if (componentSchema.properties[f].type === "boolean") {
									this.attrs[f] = this.attrs[f] ? JSON.parse(this.attrs[f]) : {};
								}
							}
						});

						delete this.attrs.id; // Don't allow direct editing of id attribute as it will break saving
						this.innerHTML = "";
						const tmpl = document.getElementById("cms-template-" + component.FileNameAsTag);
						const tmplNode = tmpl.content.cloneNode(true);
						this.appendChild(tmplNode);

						// Add data-component attribute so that the component can be referenced by client-side script
						if (!isPageHeadComponent) {
							this.firstElementChild.dataset.component = component.FileNameAsTag;
						}

						if (component.ServerScript) {
							await window.serverScripts[component.ServerScript].render(this, this.attrs);
						}

						// TODO: Maybe this should go into the index.js file so that we know when its finished and can position the toolbars
						// Rather than a timeout
						if (!inViewMode) {
							if (!this.id) {
								if (isPageHeadComponent) {
									alert(
										`There is no id attached to the <${component.FileNameAsTag}> component, so changes won't be saved`
									);
								} else {
									const cmsError = document.createElement("span");
									cmsError.innerText = "⚠ Error: No id";
									cmsError.onclick = () => {
										alert("There is no id attached to this component, so changes won't be saved");
									};
									cmsError.classList.add("cms-component-error");

									this.firstElementChild.appendChild(cmsError);
								}
							}

							if (component.ServerScript && componentSchema) {
								let componentButton;

								if (!isPageHeadComponent) {
									componentButton = document.createElement("component-button");
									componentButton.classList.add("cms-component-button");
									componentButton.innerText = `⚙ ${component.FileNameAsTag}`;
									componentButton.style.cursor = "pointer";
									this.firstElementChild.appendChild(componentButton);
								}
								(!isPageHeadComponent ? componentButton : pageHeadEl).onclick = () => {
									const dialogEl = document.createElement("component-dialog");
									dialogEl.setupJSONEditor(
										this.attrs,
										window.serverScripts[component.ServerScript].schema,
										async (editorValues) => {
											const editorValuesKeys = Object.keys(editorValues);
											for (var key of editorValuesKeys) {
												this.setAttribute(key, editorValues[key]);
											}
											await this.render();
										}
									);
									document.body.appendChild(dialogEl);
									dialogEl.showModal();
								};
							} else {
								const componentSpan = document.createElement("span");
								componentSpan.classList.add("cms-component-span");
								componentSpan.innerText = component.FileNameAsTag;
								componentSpan.style.cursor = "default";
								this.firstElementChild.appendChild(componentSpan);
							}

							if (!isPageHeadComponent) {
								this.firstElementChild.classList.add("cms-component");
							}

							// Run client code
							if (component.ClientScript) {
								window.components[this.id](this.firstElementChild);
							}
						} else {
							if (!isPageHeadComponent) {
								this.outerHTML = this.innerHTML;
							} else {
								document.head.innerHTML = this.innerHTML;
							}
						}
					}
				}
			);
		});

	// Await render all
	for (let component of components) {
		const allElements = document.querySelectorAll(component.FileNameAsTag);
		for (let element of allElements) {
			await element.render();
		}
	}
};
