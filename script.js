(function () {
  const STORAGE_KEY = "mini-scaffolding.custom-templates";
  const page = document.body.dataset.page || "generator";

  const bundledTemplates = [
    parseTemplateDefinition(`#! name: Model
#! file: {{ model.UseName }}.cs
public class {{ model.UseName }} {
{{ for item in model.Param }}    public {{ item.KeywordDataType }}{{ item.CanBeNullable ? "?" : "" }} {{ item.ColumnName }} { get; set; }
{{ end }}}`, "bundled/model.template"),
    parseTemplateDefinition(`#! name: Repository
#! file: {{ model.UseName }}Repo.cs
public class {{ model.UseName }}Repo(Dbcontrol sql) {
    public List<{{ model.UseName }}> GetAll() {
        return sql.Query<{{ model.UseName }}>("SELECT * FROM {{ model.TableQualifiedName }}");
    }

    public {{ model.UseName }} Find({{ model.PrimaryDataType }} {{ model.Primary }}) {
        return sql.QuerySingle<{{ model.UseName }}>("SELECT * FROM {{ model.TableQualifiedName }} WHERE {{ model.Primary }} = @{{ model.Primary }}", new { {{ model.Primary }} = {{ model.Primary }} });
    }
}`, "bundled/repository.template"),
    parseTemplateDefinition(`#! name: Service
#! file: {{ model.UseName }}Service.cs
public class {{ model.UseName }}Service({{ model.UseName }}Repo repo) {
    public List<{{ model.UseName }}> GetAll() => repo.GetAll();
    public {{ model.UseName }} Find({{ model.PrimaryDataType }} {{ model.Primary }}) => repo.Find({{ model.Primary }});
}`, "bundled/service.template"),
    parseTemplateDefinition(`#! name: Controller
#! file: {{ model.UseName }}Controller.cs
[Route("api/[controller]")]
[ApiController]
public class {{ model.UseName }}Controller({{ model.UseName }}Service mod) : ControllerBase {
    [HttpGet("{id{{ if model.PrimaryRouteConstraint != \"\" }}:{{ model.PrimaryRouteConstraint }}{{ end }}}")]
    public IActionResult Find({{ model.PrimaryDataType }} id) {
        return Ok(mod.Find(id));
    }
}`, "bundled/controller.template"),
    parseTemplateDefinition(`#! name: Stored Procedure
#! file: usp_{{ model.UseName }}.sql
CREATE PROCEDURE usp_{{ model.UseName }}
@Type VARCHAR(50),
{{ for item in model.ParamNoPrimary }}@{{ item.ColumnName }} {{ item.SqlDataType }} = NULL{{ if !for.last }},{{ end }}
{{ end }}
AS
BEGIN
    SELECT * FROM {{ model.TableQualifiedName }}
END`, "bundled/stored-procedure.template")
  ];

  let savedTemplateStorageError = null;
  let templates = mergeTemplates(bundledTemplates.map(cloneTemplate), loadSavedTemplates());
  let activeModalTemplateId = null;
  let collapsedTemplateIds = new Set();
  let filterState = { search: "", source: "all", category: "all" };

  if (page === "generator") {
    initGeneratorPage();
  } else if (page === "designer") {
    initDesignerPage();
  }

  function initGeneratorPage() {
    const elements = {
      tableNameInput: document.getElementById("tableNameInput"),
      classNameInput: document.getElementById("classNameInput"),
      schemaInput: document.getElementById("schemaInput"),
      generateButton: document.getElementById("generateButton"),
      clearButton: document.getElementById("clearButton"),
      loadTemplateFolderButton: document.getElementById("loadTemplateFolderButton"),
      resetTemplatesButton: document.getElementById("resetTemplatesButton"),
      templateFolderInput: document.getElementById("templateFolderInput"),
      templateCards: document.getElementById("templateCards"),
      templateCardTemplate: document.getElementById("templateCardTemplate"),
      templateCount: document.getElementById("templateCount"),
      columnCount: document.getElementById("columnCount"),
      primaryKeyLabel: document.getElementById("primaryKeyLabel"),
      parseStatus: document.getElementById("parseStatus"),
      parsedTableBody: document.getElementById("parsedTableBody"),
      templateLibraryStatus: document.getElementById("templateLibraryStatus"),
      templateSearchInput: document.getElementById("templateSearchInput"),
      sourceFilterSelect: document.getElementById("sourceFilterSelect"),
      categoryFilterSelect: document.getElementById("categoryFilterSelect"),
      collapseAllButton: document.getElementById("collapseAllButton"),
      expandAllButton: document.getElementById("expandAllButton"),
      copyAllButton: document.getElementById("copyAllButton"),
      editorModal: document.getElementById("editorModal"),
      closeEditorButton: document.getElementById("closeEditorButton"),
      modalNameInput: document.getElementById("modalNameInput"),
      modalFilePatternInput: document.getElementById("modalFilePatternInput"),
      modalBodyInput: document.getElementById("modalBodyInput"),
      saveModalTemplateButton: document.getElementById("saveModalTemplateButton"),
      saveAsNewModalTemplateButton: document.getElementById("saveAsNewModalTemplateButton"),
      deleteModalTemplateButton: document.getElementById("deleteModalTemplateButton"),
      downloadModalTemplateButton: document.getElementById("downloadModalTemplateButton"),
      modalStatus: document.getElementById("modalStatus")
    };

    elements.generateButton.addEventListener("click", generateAll);
    elements.clearButton.addEventListener("click", function () {
      elements.schemaInput.value = "";
      generateAll();
    });
    elements.loadTemplateFolderButton.addEventListener("click", function () {
      elements.templateFolderInput.click();
    });
    elements.resetTemplatesButton.addEventListener("click", function () {
      templates = mergeTemplates(bundledTemplates.map(cloneTemplate), loadSavedTemplates());
      collapsedTemplateIds = new Set();
      renderTemplateCards();
      generateAll();
    });
    elements.templateFolderInput.addEventListener("change", loadTemplateFolder);
    elements.tableNameInput.addEventListener("input", generateAll);
    elements.classNameInput.addEventListener("input", generateAll);
    elements.schemaInput.addEventListener("input", generateAll);
    elements.templateSearchInput.addEventListener("input", function () {
      filterState.search = elements.templateSearchInput.value.trim().toLowerCase();
      renderTemplateCards();
      generateAll();
    });
    enableTextareaTabIndent(elements.schemaInput);
    enableTextareaTabIndent(elements.modalBodyInput);
    elements.sourceFilterSelect.addEventListener("change", function () {
      filterState.source = elements.sourceFilterSelect.value;
      renderTemplateCards();
      generateAll();
    });
    elements.categoryFilterSelect.addEventListener("change", function () {
      filterState.category = elements.categoryFilterSelect.value;
      renderTemplateCards();
      generateAll();
    });
    elements.collapseAllButton.addEventListener("click", function () {
      getVisibleTemplates().forEach(template => collapsedTemplateIds.add(template.id));
      renderTemplateCards();
      generateAll();
    });
    elements.expandAllButton.addEventListener("click", function () {
      getVisibleTemplates().forEach(template => collapsedTemplateIds.delete(template.id));
      renderTemplateCards();
      generateAll();
    });
    elements.copyAllButton.addEventListener("click", copyAllVisibleOutputs);
    elements.closeEditorButton.addEventListener("click", closeEditorModal);
    elements.saveModalTemplateButton.addEventListener("click", function () {
      saveModalTemplate(false);
    });
    elements.saveAsNewModalTemplateButton.addEventListener("click", function () {
      saveModalTemplate(true);
    });
    elements.deleteModalTemplateButton.addEventListener("click", deleteModalTemplate);
    elements.downloadModalTemplateButton.addEventListener("click", downloadModalTemplate);
    elements.editorModal.addEventListener("click", function (event) {
      const closeTarget = event.target.closest("[data-close-modal='true']");
      if (closeTarget) closeEditorModal();
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && !elements.editorModal.classList.contains("hidden")) {
        closeEditorModal();
      }
    });

    renderTemplateCards();
    generateAll();

    async function loadTemplateFolder(event) {
      const files = Array.from(event.target.files || [])
        .filter(file => /\.(txt|tmpl|template|scriban|cs|sql|razor)$/i.test(file.name))
        .sort((a, b) => (a.webkitRelativePath || a.name).localeCompare(b.webkitRelativePath || b.name));

      if (files.length === 0) return;

      const loadedTemplates = [];
      for (const file of files) {
        const content = await file.text();
        loadedTemplates.push(parseTemplateDefinition(content, `folder/${file.webkitRelativePath || file.name}`));
      }

      templates = mergeTemplates(
        mergeTemplates(bundledTemplates.map(cloneTemplate), loadedTemplates),
        loadSavedTemplates()
      );
      renderTemplateCards();
      generateAll();
      elements.templateLibraryStatus.textContent = `Loaded ${files.length} template file(s) from folder.`;
      elements.templateLibraryStatus.className = "template-meta status-success";
      event.target.value = "";
    }

    function getVisibleTemplates() {
      return templates.filter(matchesFilter);
    }

    function matchesFilter(template) {
      const haystack = `${template.name} ${template.filePattern} ${template.sourceName}`.toLowerCase();
      if (filterState.search && !haystack.includes(filterState.search)) return false;
      if (filterState.source !== "all" && getTemplateSourceType(template) !== filterState.source) return false;
      if (filterState.category !== "all" && getTemplateCategory(template) !== filterState.category) return false;
      return true;
    }

    function renderTemplateCards() {
      elements.templateCards.innerHTML = "";
      const visibleTemplates = getVisibleTemplates();
      if (visibleTemplates.length === 0) {
        const empty = document.createElement("div");
        empty.className = "empty-state";
        empty.innerHTML = `
          <strong>No templates match the current view.</strong>
          <p>Adjust the search, change filters, or create a new template in the designer.</p>
        `;
        elements.templateCards.appendChild(empty);
      }

      visibleTemplates.forEach(template => {
        const node = elements.templateCardTemplate.content.firstElementChild.cloneNode(true);
        const output = node.querySelector(".template-output-code");
        const meta = node.querySelector(".template-meta");
        const isCollapsed = collapsedTemplateIds.has(template.id);

        node.querySelector(".template-title").textContent = template.name;
        node.querySelector(".template-file-pattern").textContent = template.filePattern || "(no file pattern)";
        node.querySelector(".template-category").textContent = categoryLabel(getTemplateCategory(template));
        node.querySelector(".template-source").textContent = sourceLabel(getTemplateSourceType(template));
        node.querySelector(".toggle-button").textContent = isCollapsed ? "Show Output" : "Hide Output";
        node.querySelector(".template-card-body").hidden = isCollapsed;

        node.querySelector(".toggle-button").addEventListener("click", function () {
          if (collapsedTemplateIds.has(template.id)) collapsedTemplateIds.delete(template.id);
          else collapsedTemplateIds.add(template.id);
          renderTemplateCards();
          generateAll();
        });

        node.querySelector(".copy-button").addEventListener("click", async function () {
          try {
            await navigator.clipboard.writeText(output.dataset.raw || "");
            meta.textContent = `${template.sourceName} | copied`;
            meta.className = "template-meta status-success";
          } catch (error) {
            meta.textContent = `${template.sourceName} | copy failed`;
            meta.className = "template-meta status-error";
          }
        });

        node.querySelector(".duplicate-button").addEventListener("click", function () {
          try {
            const duplicate = createTemplateCopy(template);
            const savedTemplates = loadSavedTemplates();
            savedTemplates.push(duplicate);
            persistSavedTemplates(savedTemplates);
            templates = mergeTemplates(templates, loadSavedTemplates());
            collapsedTemplateIds.delete(duplicate.id);
            renderTemplateCards();
            generateAll();
            elements.templateLibraryStatus.textContent = `Duplicated "${template.name}" into your saved library.`;
            elements.templateLibraryStatus.className = "template-meta status-success";
          } catch (error) {
            elements.templateLibraryStatus.textContent = String(error && error.message ? error.message : error);
            elements.templateLibraryStatus.className = "template-meta status-error";
          }
        });

        node.querySelector(".edit-button").addEventListener("click", function () {
          openEditorModal(template.id);
        });

        template.outputElement = output;
        template.metaElement = meta;
        elements.templateCards.appendChild(node);
      });

      elements.templateCount.textContent = String(visibleTemplates.length);
      if (!elements.templateLibraryStatus.classList.contains("status-success")) {
        if (savedTemplateStorageError) {
          elements.templateLibraryStatus.textContent = savedTemplateStorageError;
          elements.templateLibraryStatus.className = "template-meta status-error";
        } else {
          elements.templateLibraryStatus.textContent = `${loadSavedTemplates().length} saved template(s), ${templates.length} total loaded.`;
          elements.templateLibraryStatus.className = "template-meta";
        }
      }
    }

    function generateAll() {
      try {
        const parsed = parseSchema(elements.schemaInput.value);
        const model = buildModel(parsed, elements.tableNameInput.value, elements.classNameInput.value);
        updateParsedTable(model);

        getVisibleTemplates().forEach(template => {
          try {
            const rendered = renderTemplate(template.body, buildScope(model));
            if (template.outputElement) setTemplateOutput(template, rendered.trim(), renderFilePattern(template.filePattern, model));
            if (template.metaElement) {
              template.metaElement.textContent = `${template.sourceName} | ${renderFilePattern(template.filePattern, model)}`;
              template.metaElement.className = "template-meta";
            }
          } catch (error) {
            if (template.outputElement) setTemplateOutput(template, describeTemplateError(error, template.body), template.filePattern || "");
            if (template.metaElement) {
              template.metaElement.textContent = `${template.sourceName} | template error`;
              template.metaElement.className = "template-meta status-error";
            }
          }
        });
      } catch (error) {
        updateParsedTableError(error);
        getVisibleTemplates().forEach(template => {
          if (template.outputElement) setTemplateOutput(template, "", template.filePattern || "");
          if (template.metaElement) {
            template.metaElement.textContent = `${template.sourceName} | waiting for valid schema`;
            template.metaElement.className = "template-meta";
          }
        });
      }
    }

    async function copyAllVisibleOutputs() {
      const chunks = [];
      getVisibleTemplates().forEach(template => {
        const raw = template.outputElement ? (template.outputElement.dataset.raw || "") : "";
        if (!raw.trim()) return;
        chunks.push([
          template.name,
          renderFilePatternSafe(template.filePattern),
          raw.trim()
        ].join("\n"));
      });

      if (chunks.length === 0) {
        elements.templateLibraryStatus.textContent = "Nothing to copy yet. Generate valid output first.";
        elements.templateLibraryStatus.className = "template-meta status-error";
        return;
      }

      try {
        await navigator.clipboard.writeText(chunks.join("\n\n------------------------------\n\n"));
        elements.templateLibraryStatus.textContent = `Copied ${chunks.length} visible output(s).`;
        elements.templateLibraryStatus.className = "template-meta status-success";
      } catch (error) {
        elements.templateLibraryStatus.textContent = "Copy all failed in this browser.";
        elements.templateLibraryStatus.className = "template-meta status-error";
      }
    }

    function renderFilePatternSafe(filePattern) {
      try {
        const parsed = parseSchema(elements.schemaInput.value);
        const model = buildModel(parsed, elements.tableNameInput.value, elements.classNameInput.value);
        return renderFilePattern(filePattern, model);
      } catch (error) {
        return filePattern || "no file pattern";
      }
    }

    function updateParsedTable(model) {
      elements.columnCount.textContent = String(model.Param.length);
      elements.primaryKeyLabel.textContent = model.Primary || "-";
      elements.parseStatus.textContent = `${model.Param.length} column(s) ready`;
      elements.parseStatus.className = "status-success";
      elements.parsedTableBody.innerHTML = "";

      model.Param.forEach(field => {
        const row = document.createElement("tr");
        row.innerHTML = `
          <td>${escapeHtml(field.ColumnName)}</td>
          <td>${escapeHtml(field.KeywordDataType)}</td>
          <td>${escapeHtml(field.SqlDataType)}</td>
          <td>${field.Nullable ? "Yes" : "No"}</td>
          <td>${field.IsAutoIncrement ? "Yes" : "No"}</td>
        `;
        elements.parsedTableBody.appendChild(row);
      });
    }

    function updateParsedTableError(error) {
      elements.columnCount.textContent = "0";
      elements.primaryKeyLabel.textContent = "-";
      elements.parseStatus.textContent = String(error && error.message ? error.message : error);
      elements.parseStatus.className = "status-error";
      elements.parsedTableBody.innerHTML = "";
    }

    function openEditorModal(templateId) {
      const template = templates.find(item => item.id === templateId);
      if (!template) return;

      activeModalTemplateId = templateId;
      elements.modalNameInput.value = template.name;
      elements.modalFilePatternInput.value = template.filePattern;
      elements.modalBodyInput.value = template.body;
      elements.modalStatus.textContent = template.sourceName;
      elements.modalStatus.className = "template-meta";
      elements.deleteModalTemplateButton.hidden = getTemplateSourceType(template) !== "saved";
      elements.editorModal.classList.remove("hidden");
      elements.editorModal.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
    }

    function closeEditorModal() {
      activeModalTemplateId = null;
      elements.editorModal.classList.add("hidden");
      elements.editorModal.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
    }

    function saveModalTemplate(saveAsNew) {
      const template = templates.find(item => item.id === activeModalTemplateId);
      if (!template) return;

      const nextName = elements.modalNameInput.value.trim();
      const nextFilePattern = elements.modalFilePatternInput.value.trim();
      const nextBody = elements.modalBodyInput.value.trim();

      if (!nextName || !nextFilePattern || !nextBody) {
        elements.modalStatus.textContent = "Template name, file pattern, and body are required.";
        elements.modalStatus.className = "template-meta status-error";
        return;
      }

      try {
        validateTemplateForAuthoring(nextFilePattern, nextBody);
        const savedTemplates = loadSavedTemplates();
        const currentSavedTemplate = savedTemplates.find(item => item.id === template.id);

        if (!saveAsNew) {
          const conflicting = savedTemplates.find(item => item.id !== template.id && item.id === createId(nextName));
          if (conflicting) {
            throw new Error(`A saved template named "${conflicting.name}" already exists. Rename this template or use Save As New.`);
          }
        }

        if (saveAsNew) {
          const duplicate = {
            id: createUniqueId(nextName, loadSavedTemplates().map(item => item.id)),
            name: nextName,
            filePattern: nextFilePattern,
            body: nextBody,
            sourceName: `saved/${nextName}`
          };
          savedTemplates.push(duplicate);
          persistSavedTemplates(savedTemplates);
          templates = mergeTemplates(templates, loadSavedTemplates());
          activeModalTemplateId = duplicate.id;
          elements.deleteModalTemplateButton.hidden = false;
          elements.modalStatus.textContent = `Saved "${duplicate.name}" as a new template.`;
          elements.modalStatus.className = "template-meta status-success";
          renderTemplateCards();
          generateAll();
          return;
        }

        const savedIndex = savedTemplates.findIndex(item => item.id === template.id);

        if (savedIndex >= 0) {
          const nextTemplate = cloneTemplate({
            id: template.id,
            name: nextName,
            filePattern: nextFilePattern,
            body: nextBody,
            sourceName: `saved/${nextName}`
          });
          savedTemplates[savedIndex] = nextTemplate;
          persistSavedTemplates(savedTemplates);
          Object.assign(template, nextTemplate);
          elements.deleteModalTemplateButton.hidden = false;
          elements.modalStatus.textContent = `Saved updates to "${nextName}".`;
        } else {
          if (currentSavedTemplate) {
            throw new Error(`A saved template named "${currentSavedTemplate.name}" already exists. Load it first or use Save As New.`);
          }
          const promoted = cloneTemplate({
            id: createUniqueId(nextName, loadSavedTemplates().map(item => item.id).concat(templates.map(item => item.id))),
            name: nextName,
            filePattern: nextFilePattern,
            body: nextBody,
            sourceName: `saved/${nextName}`
          });
          savedTemplates.push(promoted);
          persistSavedTemplates(savedTemplates);
          templates = mergeTemplates(templates, loadSavedTemplates());
          activeModalTemplateId = promoted.id;
          elements.deleteModalTemplateButton.hidden = false;
          elements.modalStatus.textContent = `Saved "${nextName}" into your template library.`;
        }

        elements.modalStatus.className = "template-meta status-success";
        renderTemplateCards();
        generateAll();
      } catch (error) {
        elements.modalStatus.textContent = String(error && error.message ? error.message : error);
        elements.modalStatus.className = "template-meta status-error";
      }
    }

    function deleteModalTemplate() {
      const template = templates.find(item => item.id === activeModalTemplateId);
      if (!template || getTemplateSourceType(template) !== "saved") {
        elements.modalStatus.textContent = "Only saved templates can be deleted here.";
        elements.modalStatus.className = "template-meta status-error";
        return;
      }

      try {
        const nextSavedTemplates = loadSavedTemplates().filter(item => item.id !== template.id);
        persistSavedTemplates(nextSavedTemplates);
        templates = mergeTemplates(templates.filter(item => item.id !== template.id), nextSavedTemplates);
        closeEditorModal();
        renderTemplateCards();
        generateAll();
        elements.templateLibraryStatus.textContent = `Deleted "${template.name}" from your saved library.`;
        elements.templateLibraryStatus.className = "template-meta status-success";
      } catch (error) {
        elements.modalStatus.textContent = String(error && error.message ? error.message : error);
        elements.modalStatus.className = "template-meta status-error";
      }
    }

    function downloadModalTemplate() {
      const template = templates.find(item => item.id === activeModalTemplateId);
      if (!template) return;

      const nextTemplate = {
        id: template.id,
        name: elements.modalNameInput.value.trim(),
        filePattern: elements.modalFilePatternInput.value.trim(),
        body: elements.modalBodyInput.value.trim(),
        sourceName: template.sourceName
      };

      if (!nextTemplate.name || !nextTemplate.filePattern || !nextTemplate.body) {
        elements.modalStatus.textContent = "Template name, file pattern, and body are required.";
        elements.modalStatus.className = "template-meta status-error";
        return;
      }

      downloadTemplateFile(nextTemplate);
      elements.modalStatus.textContent = `Downloaded "${nextTemplate.name}".`;
      elements.modalStatus.className = "template-meta status-success";
    }
  }

  function initDesignerPage() {
    const elements = {
      designerNameInput: document.getElementById("designerNameInput"),
      designerFileInput: document.getElementById("designerFileInput"),
      designerBodyInput: document.getElementById("designerBodyInput"),
      saveTemplateButton: document.getElementById("saveTemplateButton"),
      saveAsNewDesignerButton: document.getElementById("saveAsNewDesignerButton"),
      downloadTemplateButton: document.getElementById("downloadTemplateButton"),
      clearDesignerButton: document.getElementById("clearDesignerButton"),
      designerStatus: document.getElementById("designerStatus"),
      designerSearchInput: document.getElementById("designerSearchInput"),
      savedTemplateList: document.getElementById("savedTemplateList")
    };

    let activeDesignerTemplateId = null;
    let designerSearch = "";

    enableTextareaTabIndent(elements.designerBodyInput);

    elements.saveTemplateButton.addEventListener("click", function () {
      try {
        const template = buildDesignerTemplate(elements, activeDesignerTemplateId);
        const savedTemplates = loadSavedTemplates();
        if (!activeDesignerTemplateId) {
          const conflicting = savedTemplates.find(item => item.id === createId(template.name));
          if (conflicting) {
            throw new Error(`A saved template named "${conflicting.name}" already exists. Use Save As New or load it first.`);
          }
        } else {
          const conflicting = savedTemplates.find(item => item.id !== activeDesignerTemplateId && item.id === createId(template.name));
          if (conflicting) {
            throw new Error(`A saved template named "${conflicting.name}" already exists. Rename this template or use Save As New.`);
          }
        }
        const existingIndex = savedTemplates.findIndex(item => item.id === template.id);
        if (existingIndex >= 0) savedTemplates[existingIndex] = template;
        else savedTemplates.push(template);
        persistSavedTemplates(savedTemplates);
        activeDesignerTemplateId = template.id;
        renderSavedLibrary();
        elements.designerStatus.textContent = `Saved template "${template.name}".`;
        elements.designerStatus.className = "template-meta status-success";
      } catch (error) {
        elements.designerStatus.textContent = String(error && error.message ? error.message : error);
        elements.designerStatus.className = "template-meta status-error";
      }
    });

    elements.saveAsNewDesignerButton.addEventListener("click", function () {
      try {
        const template = buildDesignerTemplate(elements, null);
        const savedTemplates = loadSavedTemplates();
        template.id = createUniqueId(template.name, savedTemplates.map(item => item.id));
        savedTemplates.push(template);
        persistSavedTemplates(savedTemplates);
        activeDesignerTemplateId = template.id;
        renderSavedLibrary();
        elements.designerStatus.textContent = `Saved "${template.name}" as a new template.`;
        elements.designerStatus.className = "template-meta status-success";
      } catch (error) {
        elements.designerStatus.textContent = String(error && error.message ? error.message : error);
        elements.designerStatus.className = "template-meta status-error";
      }
    });

    elements.downloadTemplateButton.addEventListener("click", function () {
      try {
        const template = buildDesignerTemplate(elements, activeDesignerTemplateId);
        downloadTemplateFile(template);
        elements.designerStatus.textContent = `Downloaded template "${template.name}".`;
        elements.designerStatus.className = "template-meta status-success";
      } catch (error) {
        elements.designerStatus.textContent = String(error && error.message ? error.message : error);
        elements.designerStatus.className = "template-meta status-error";
      }
    });

    elements.clearDesignerButton.addEventListener("click", function () {
      activeDesignerTemplateId = null;
      elements.designerNameInput.value = "";
      elements.designerFileInput.value = "";
      elements.designerBodyInput.value = "";
      elements.designerStatus.textContent = "Use the designer for library templates. Saved items appear below for quick duplicate, delete, and reload.";
      elements.designerStatus.className = "template-meta";
      renderSavedLibrary();
    });

    elements.designerSearchInput.addEventListener("input", function () {
      designerSearch = elements.designerSearchInput.value.trim().toLowerCase();
      renderSavedLibrary();
    });

    renderSavedLibrary();

    function renderSavedLibrary() {
      const savedTemplates = loadSavedTemplates().filter(template => {
        if (!designerSearch) return true;
        const haystack = `${template.name} ${template.filePattern}`.toLowerCase();
        return haystack.includes(designerSearch);
      });

      if (savedTemplateStorageError) {
        elements.savedTemplateList.innerHTML = "";
        const error = document.createElement("div");
        error.className = "empty-state";
        error.innerHTML = `
          <strong>Saved templates are unavailable.</strong>
          <p>${escapeHtml(savedTemplateStorageError)}</p>
        `;
        elements.savedTemplateList.appendChild(error);
        elements.designerStatus.textContent = savedTemplateStorageError;
        elements.designerStatus.className = "template-meta status-error";
        return;
      }

      elements.savedTemplateList.innerHTML = "";
      if (savedTemplates.length === 0) {
        const empty = document.createElement("div");
        empty.className = "empty-state";
        empty.innerHTML = `
          <strong>No saved templates found.</strong>
          <p>Create one here or clear the search filter.</p>
        `;
        elements.savedTemplateList.appendChild(empty);
        return;
      }

      savedTemplates.forEach(template => {
        const item = document.createElement("article");
        item.className = "saved-template-item";
        if (template.id === activeDesignerTemplateId) item.classList.add("is-active");
        item.innerHTML = `
          <div class="saved-template-copy">
            <strong>${escapeHtml(template.name)}</strong>
            <p>${escapeHtml(template.filePattern || "(no file pattern)")}</p>
          </div>
          <div class="saved-template-actions">
            <button type="button" class="secondary-button" data-action="load">Load</button>
            <button type="button" class="secondary-button" data-action="duplicate">Duplicate</button>
            <button type="button" class="secondary-button" data-action="delete">Delete</button>
          </div>
        `;

        item.addEventListener("click", function (event) {
          const button = event.target.closest("[data-action]");
          if (!button) return;
          const action = button.getAttribute("data-action");

          if (action === "load") {
            activeDesignerTemplateId = template.id;
            elements.designerNameInput.value = template.name;
            elements.designerFileInput.value = template.filePattern;
            elements.designerBodyInput.value = template.body;
            elements.designerStatus.textContent = `Loaded "${template.name}" into the editor.`;
            elements.designerStatus.className = "template-meta status-success";
            renderSavedLibrary();
            return;
          }

          if (action === "duplicate") {
            try {
              const saved = loadSavedTemplates();
              const copy = createTemplateCopy(template);
              saved.push(copy);
              persistSavedTemplates(saved);
              activeDesignerTemplateId = copy.id;
              elements.designerNameInput.value = copy.name;
              elements.designerFileInput.value = copy.filePattern;
              elements.designerBodyInput.value = copy.body;
              elements.designerStatus.textContent = `Duplicated "${template.name}".`;
              elements.designerStatus.className = "template-meta status-success";
              renderSavedLibrary();
            } catch (error) {
              elements.designerStatus.textContent = String(error && error.message ? error.message : error);
              elements.designerStatus.className = "template-meta status-error";
            }
            return;
          }

          if (action === "delete") {
            try {
              const nextSaved = loadSavedTemplates().filter(itemTemplate => itemTemplate.id !== template.id);
              persistSavedTemplates(nextSaved);
              if (activeDesignerTemplateId === template.id) {
                activeDesignerTemplateId = null;
                elements.designerNameInput.value = "";
                elements.designerFileInput.value = "";
                elements.designerBodyInput.value = "";
              }
              elements.designerStatus.textContent = `Deleted "${template.name}".`;
              elements.designerStatus.className = "template-meta status-success";
              renderSavedLibrary();
            } catch (error) {
              elements.designerStatus.textContent = String(error && error.message ? error.message : error);
              elements.designerStatus.className = "template-meta status-error";
            }
          }
        });

        elements.savedTemplateList.appendChild(item);
      });
    }
  }

  function buildDesignerTemplate(elements, explicitId) {
    const name = (elements.designerNameInput.value || "").trim();
    const filePattern = (elements.designerFileInput.value || "").trim();
    const body = (elements.designerBodyInput.value || "").trim();

    if (!name) throw new Error("Template Name is required.");
    if (!filePattern) throw new Error("Output File Pattern is required.");
    if (!body) throw new Error("Template Body is required.");
    validateTemplateForAuthoring(filePattern, body);

    return {
      id: explicitId || createId(name),
      name,
      filePattern,
      body,
      sourceName: `saved/${name}`
    };
  }

  function createTemplateCopy(template) {
    const savedIds = loadSavedTemplates().map(item => item.id);
    const nextName = `${template.name} Copy`;
    return {
      id: createUniqueId(nextName, savedIds),
      name: nextName,
      filePattern: template.filePattern,
      body: template.body,
      sourceName: `saved/${nextName}`
    };
  }

  function createUniqueId(value, existingIds) {
    const taken = new Set(existingIds || []);
    const base = createId(value) || "template";
    if (!taken.has(base)) return base;
    let index = 2;
    while (taken.has(`${base}-${index}`)) index += 1;
    return `${base}-${index}`;
  }

  function downloadTemplateFile(template) {
    const content = `#! name: ${template.name}\n#! file: ${template.filePattern}\n${template.body}\n`;
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = `${template.id || "template"}.template.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function loadSavedTemplates() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      savedTemplateStorageError = null;
      if (!Array.isArray(parsed)) {
        savedTemplateStorageError = "Saved template library is in an invalid format in browser storage.";
        return [];
      }
      let changed = false;
      const normalized = parsed
        .filter(item => item && item.name && item.filePattern && item.body)
        .map(function (item) {
          const nextItem = normalizeSavedTemplate(item);
          if (
            nextItem.name !== item.name ||
            nextItem.filePattern !== item.filePattern ||
            nextItem.body !== item.body ||
            nextItem.sourceName !== item.sourceName ||
            nextItem.id !== item.id
          ) {
            changed = true;
          }
          return cloneTemplate(nextItem);
        });

      if (changed) {
        try {
          persistSavedTemplates(normalized);
        } catch (error) {
          // Keep using the normalized in-memory templates even if the migration cannot be written back.
        }
      }

      return normalized;
    } catch (error) {
      savedTemplateStorageError = "Saved template library could not be loaded from browser storage.";
      return [];
    }
  }

  function persistSavedTemplates(savedTemplates) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(savedTemplates));
      savedTemplateStorageError = null;
    } catch (error) {
      savedTemplateStorageError = "Saved template library could not be written to browser storage.";
      throw error;
    }
  }

  function mergeTemplates(primaryTemplates, savedTemplates) {
    const merged = [];
    const seen = new Map();

    primaryTemplates.forEach(template => {
      const normalized = cloneTemplate(template);
      merged.push(normalized);
      seen.set(normalized.id, merged.length - 1);
    });

    savedTemplates.forEach(template => {
      const normalized = cloneTemplate(template);
      if (seen.has(normalized.id)) merged[seen.get(normalized.id)] = normalized;
      else {
        seen.set(normalized.id, merged.length);
        merged.push(normalized);
      }
    });

    return merged;
  }

  function parseTemplateDefinition(content, sourceName) {
    const lines = String(content || "").replace(/\r\n/g, "\n").split("\n");
    const metadata = { name: fileNameWithoutExtension(sourceName), filePattern: "" };
    let bodyStart = 0;

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      if (!line.startsWith("#!")) {
        bodyStart = index;
        break;
      }

      const separatorIndex = line.indexOf(":");
      if (separatorIndex > -1) {
        const key = line.slice(2, separatorIndex).trim().toLowerCase();
        const value = line.slice(separatorIndex + 1).trim();
        if (key === "name") metadata.name = value;
        if (key === "file") metadata.filePattern = value;
      }
      bodyStart = index + 1;
    }

    return {
      id: createId(sourceName),
      name: metadata.name,
      filePattern: metadata.filePattern,
      body: lines.slice(bodyStart).join("\n").trim(),
      sourceName
    };
  }

  function cloneTemplate(template) {
    return {
      id: template.id || createId(template.name),
      name: template.name,
      filePattern: template.filePattern,
      body: template.body,
      sourceName: template.sourceName || `saved/${template.name}`
    };
  }

  function normalizeSavedTemplate(template) {
    const nextTemplate = cloneTemplate(template);

    if (looksLikeLegacyStoredProcedureTemplate(nextTemplate)) {
      nextTemplate.body = nextTemplate.body
        .replace(/model\.Param\b/g, "model.ParamNoPrimary");
    }

    return nextTemplate;
  }

  function looksLikeLegacyStoredProcedureTemplate(template) {
    const name = String(template.name || "").trim().toLowerCase();
    const filePattern = String(template.filePattern || "").trim().toLowerCase();
    const body = String(template.body || "");

    return (
      name === "stored procedure" &&
      /\.sql$/.test(filePattern) &&
      /create\s+procedure/i.test(body) &&
      /@Type\s+VARCHAR\(50\)/i.test(body) &&
      /if\s+@Type\s*=\s*'Create'/i.test(body) &&
      /insert\s+into/i.test(body) &&
      /\{\{\s*for item in model\.Param\s*\}\}/.test(body)
    );
  }

  function getTemplateSourceType(template) {
    if (/^saved\//i.test(template.sourceName || "")) return "saved";
    if (/^folder\//i.test(template.sourceName || "")) return "folder";
    return "bundled";
  }

  function getTemplateCategory(template) {
    const value = `${template.name} ${template.filePattern} ${template.sourceName}`.toLowerCase();
    if (/\.sql\b|stored/.test(value)) return "sql";
    if (/\.razor\b|list|add|edit/.test(value)) return "page";
    if (/controller/.test(value)) return "controller";
    if (/service/.test(value)) return "service";
    if (/repo|repository/.test(value)) return "repository";
    if (/model|class|entity/.test(value)) return "model";
    return "other";
  }

  function sourceLabel(value) {
    return { bundled: "Bundled", saved: "Saved", folder: "Folder" }[value] || "Template";
  }

  function categoryLabel(value) {
    return {
      model: "Model",
      repository: "Repository",
      service: "Service",
      controller: "Controller",
      sql: "SQL",
      page: "Page",
      other: "Other"
    }[value] || "Other";
  }

  function enableTextareaTabIndent(textarea) {
    if (!textarea) return;
    textarea.addEventListener("keydown", function (event) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const value = textarea.value;

      if (event.key === "Enter") {
        event.preventDefault();
        const lineStart = value.lastIndexOf("\n", start - 1) + 1;
        const currentLine = value.slice(lineStart, start);
        const baseIndent = (currentLine.match(/^[ \t]*/) || [""])[0];
        const trimmedLine = currentLine.trimEnd();
        const indentUnit = "  ";
        const extraIndent = /[\{\[\(\:]$/.test(trimmedLine) ? indentUnit : "";
        const insertion = `\n${baseIndent}${extraIndent}`;
        textarea.value = value.slice(0, start) + insertion + value.slice(end);
        textarea.selectionStart = textarea.selectionEnd = start + insertion.length;
        return;
      }

      if (event.key !== "Tab") return;

      event.preventDefault();

      if (event.shiftKey) {
        const lineStart = value.lastIndexOf("\n", start - 1) + 1;
        const selectedText = value.slice(lineStart, end);
        const lines = selectedText.split("\n");
        let removed = 0;
        const updated = lines.map(function (line) {
          if (line.startsWith("  ")) {
            removed += 2;
            return line.slice(2);
          }
          if (line.startsWith("\t")) {
            removed += 1;
            return line.slice(1);
          }
          return line;
        }).join("\n");
        textarea.value = value.slice(0, lineStart) + updated + value.slice(end);
        textarea.selectionStart = lineStart;
        textarea.selectionEnd = Math.max(lineStart, end - removed);
        return;
      }

      if (start !== end && value.slice(start, end).includes("\n")) {
        const lineStart = value.lastIndexOf("\n", start - 1) + 1;
        const selectedText = value.slice(lineStart, end);
        const lines = selectedText.split("\n");
        const updated = lines.map(function (line) { return `  ${line}`; }).join("\n");
        textarea.value = value.slice(0, lineStart) + updated + value.slice(end);
        textarea.selectionStart = lineStart;
        textarea.selectionEnd = end + (lines.length * 2);
        return;
      }

      textarea.value = value.slice(0, start) + "  " + value.slice(end);
      textarea.selectionStart = textarea.selectionEnd = start + 2;
    });
  }

  function parseSchema(input) {
    const text = (input || "").trim();
    if (!text) throw new Error("Paste a table scheme first.");
    return /create\s+table/i.test(text) ? parseCreateTable(text) : parseGridText(text);
  }

  function parseCreateTable(text) {
    const rows = [];
    const primaryKeyColumns = extractPrimaryKeyColumns(text);
    text.replace(/\r\n/g, "\n").split("\n").forEach(line => {
      const trimmed = line.trim().replace(/,$/, "");
      if (
        !trimmed ||
        trimmed.startsWith("(") ||
        trimmed.startsWith(")") ||
        /^use\b/i.test(trimmed) ||
        /^go\b/i.test(trimmed) ||
        /^set\b/i.test(trimmed) ||
        /^create\s+table/i.test(trimmed) ||
        /^alter\s+table/i.test(trimmed) ||
        /^constraint/i.test(trimmed) ||
        /^primary\s+key/i.test(trimmed) ||
        /^unique/i.test(trimmed) ||
        /^foreign\s+key/i.test(trimmed) ||
        /^\)\s*on\b/i.test(trimmed)
      ) return;

      const match = trimmed.match(/^\[?([A-Za-z0-9_]+)\]?\s+\[?([A-Za-z0-9]+)\]?(\(([^)]*)\))?(.*)$/i);
      if (!match) return;
      rows.push(createField({
        columnName: match[1],
        dataTypeName: match[2].toLowerCase(),
        typeArgs: match[4] || "",
        remainder: match[5] || "",
        isPrimaryKey: primaryKeyColumns.has(String(match[1] || "").toLowerCase()) || /primary\s+key/i.test(match[5] || "")
      }));
    });
    if (rows.length === 0) throw new Error("No columns were detected from the CREATE TABLE text.");
    return rows;
  }

  function parseGridText(text) {
    const lines = text.replace(/\r\n/g, "\n").split("\n").map(line => line.trim()).filter(Boolean);
    const rows = [];
    lines.forEach(line => {
      if (/^column[_ ]?name/i.test(line) || /^column\s+name/i.test(line)) return;
      const tabParts = line.split("\t").map(part => part.trim()).filter(Boolean);
      const parts = tabParts.length > 1 ? tabParts : line.split(/\s{2,}|\t+/).map(part => part.trim()).filter(Boolean);
      if (parts.length < 2) return;
      rows.push(createField({
        columnName: parts[0].replace(/[\[\]]/g, ""),
        dataTypeName: normalizeSqlType(parts[1]),
        typeArgs: extractTypeArgs(parts[1]),
        remainder: parts.slice(2).join(" "),
        isPrimaryKey: /primary\s+key/i.test(parts.slice(2).join(" "))
      }));
    });
    if (rows.length === 0) throw new Error("No columns were detected from the pasted schema.");
    return rows;
  }

  function createField(source) {
    const typeArgs = parseTypeArgs(source.typeArgs);
    const identity = /identity|auto/i.test(source.remainder);
    const nullable = !/not null/i.test(source.remainder);
    const typeMeta = mapSqlTypeToJs(source.dataTypeName, typeArgs);
    return {
      ColumnName: source.columnName,
      ReadableName: toReadableName(source.columnName),
      DataTypeName: source.dataTypeName,
      ColumnSize: typeMeta.columnSize,
      IsAutoIncrement: identity,
      NumericPrecision: typeMeta.numericPrecision,
      NumericScale: typeMeta.numericScale,
      isLong: typeMeta.isLong,
      KeywordDataType: typeMeta.keywordDataType,
      CanBeNullable: typeMeta.canBeNullable && nullable,
      SqlDataType: buildSqlDataType(source.dataTypeName, typeMeta),
      Nullable: nullable,
      IsPrimaryKey: Boolean(source.isPrimaryKey)
    };
  }

  function buildModel(rows, tableNameInput, classNameInput) {
    const tableName = (tableNameInput || "").trim() || "dbo.tbl_sample";
    const className = (classNameInput || "").trim();
    const model = { Table: tableName, Class: className, Param: rows, ForeignKeys: [] };

    Object.defineProperties(model, {
      UseName: { get: function () { return this.Class || sanitizeTypeName(this.TableName); } },
      TableSchema: { get: function () { return parseTableIdentifier(this.Table).schema; } },
      TableName: { get: function () { return parseTableIdentifier(this.Table).name; } },
      TableQualifiedName: { get: function () { return parseTableIdentifier(this.Table).qualifiedName; } },
      Primary: { get: function () { return (getPrimaryField(this.Param) || {}).ColumnName || ""; } },
      PrimaryDataType: { get: function () { return (getPrimaryField(this.Param) || {}).KeywordDataType || ""; } },
      PrimaryRouteConstraint: { get: function () { return mapRouteConstraint(this.PrimaryDataType); } },
      ParamNoPrimary: {
        get: function () {
          const primaryField = getPrimaryField(this.Param);
          if (!primaryField) return this.Param.slice();
          return this.Param.filter(field => field !== primaryField);
        }
      },
      ClassLower: { get: function () { return (this.Class || this.UseName || "").toLowerCase(); } }
    });

    return model;
  }

  function buildScope(model) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    return {
      model,
      date: {
        now,
        today,
        year: now.getFullYear(),
        month: now.getMonth() + 1,
        day: now.getDate()
      }
    };
  }

  function renderFilePattern(filePattern, model) {
    return filePattern ? renderTemplate(filePattern, buildScope(model)) : "no file pattern";
  }

  function setTemplateOutput(template, rawText, fileName) {
    if (!template.outputElement) return;
    const normalized = String(rawText || "");
    template.outputElement.dataset.raw = normalized;
    template.outputElement.innerHTML = highlightCode(normalized, detectLanguage(fileName));
  }

  function renderTemplate(templateText, scope) {
    const tokens = tokenizeTemplate(String(templateText || "").replace(/\r\n/g, "\n"));
    const compiler = new TemplateCompiler();
    const rendererBody = compiler.compile(tokens);
    const renderer = new Function("__scope", "__helpers", `const window = undefined, document = undefined, globalThis = undefined, global = undefined, self = undefined, Function = undefined, eval = undefined, fetch = undefined, XMLHttpRequest = undefined, localStorage = undefined, sessionStorage = undefined, navigator = undefined, location = undefined, history = undefined, process = undefined, require = undefined, module = undefined, Object = undefined, Reflect = undefined, Proxy = undefined, Array = undefined; with (__helpers) { with (__scope) { ${rendererBody} } }`);
    return renderer(scope, templateHelpers);
  }

  function validateTemplateForAuthoring(filePattern, body) {
    validateTemplateFragment(filePattern, "Output File Pattern");
    validateTemplateFragment(body, "Template Body");
  }

  function validateTemplateFragment(value, label) {
    try {
      const tokens = tokenizeTemplate(String(value || "").replace(/\r\n/g, "\n"));
      const compiler = new TemplateCompiler();
      compiler.compile(tokens);
    } catch (error) {
      const message = String(error && error.message ? error.message : error);
      throw new Error(`${label}: ${message}`);
    }
  }

  function describeTemplateError(error, templateBody) {
    const message = String(error && error.message ? error.message : error);
    const body = String(templateBody || "");

    if (isLikelyUnsupportedScriban(body, message)) {
      return `${message}

This template is using syntax that is still outside the portable renderer.
Supported in this browser version:
- {{ model.* }}
- {{ for item in model.Param }} ... {{ end }}
- {{ if condition }} ... {{ else }} ... {{ end }}
- basic ternary, &&, ||, !, comparisons
- common pipe helpers like string.upper, string.lower, string.trim, string.replace, array.join, array.size, default, empty

If one of your desktop templates still fails, it likely needs either a smaller syntax tweak or another helper added here.`;
    }

    return message;
  }

  function detectLanguage(fileName) {
    const value = String(fileName || "").toLowerCase();
    if (value.endsWith(".cs")) return "cs";
    if (value.endsWith(".sql")) return "sql";
    if (value.endsWith(".razor")) return "razor";
    return "plain";
  }

  function highlightCode(source, language) {
    const text = String(source || "");
    if (!text) return "";
    if (language === "cs") return highlightCSharp(text);
    if (language === "sql") return highlightSql(text);
    if (language === "razor") return highlightRazor(text);
    return escapeHtml(text);
  }

  function highlightCSharp(source) {
    return tokenizeAndRender(source, [
      { type: "comment", regex: /\/\/.*$/gm },
      { type: "string", regex: /"(?:\\.|[^"\\])*"/g },
      { type: "keyword", regex: /\b(public|private|protected|internal|class|return|new|void|bool|int|long|short|byte|string|decimal|double|float|using|namespace|if|else|for|foreach|while|switch|case|break|continue|async|await|var|null|true|false|static|partial|get|set)\b/g },
      { type: "type", regex: /\b([A-Z][A-Za-z0-9_]*)\b/g }
    ]);
  }

  function highlightSql(source) {
    return tokenizeAndRender(source, [
      { type: "comment", regex: /--.*$/gm },
      { type: "string", regex: /'(?:''|[^'])*'/g },
      { type: "keyword", regex: /\b(SELECT|FROM|WHERE|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|PROCEDURE|TABLE|ALTER|ADD|CONSTRAINT|DEFAULT|BEGIN|END|AS|IF|NOT|NULL|IDENTITY|TOP|CAST|BIT|VARCHAR|NVARCHAR|DATETIME|INT|BIGINT|DECIMAL)\b/gi }
    ]);
  }

  function highlightRazor(source) {
    return tokenizeAndRender(source, [
      { type: "comment", regex: /@\\*[\s\S]*?\\*@/g },
      { type: "string", regex: /"(?:\\.|[^"\\])*"/g },
      { type: "directive", regex: /@[A-Za-z_][A-Za-z0-9_]*/g },
      { type: "tag", regex: /<\/?[A-Za-z][^>\n]*>/g },
      { type: "keyword", regex: /\b(public|private|protected|class|return|new|void|bool|int|long|string|decimal|double|float|if|else|for|foreach|while|async|await|var|null|true|false|get|set)\b/g }
    ]);
  }

  function tokenizeAndRender(source, rules) {
    const tokens = [];
    const occupied = new Array(source.length).fill(false);

    rules.forEach(rule => {
      const regex = new RegExp(rule.regex.source, rule.regex.flags);
      let match;
      while ((match = regex.exec(source)) !== null) {
        const start = match.index;
        const text = match[0];
        const end = start + text.length;
        if (!text) {
          regex.lastIndex += 1;
          continue;
        }
        let blocked = false;
        for (let index = start; index < end; index += 1) {
          if (occupied[index]) {
            blocked = true;
            break;
          }
        }
        if (blocked) continue;
        for (let index = start; index < end; index += 1) {
          occupied[index] = true;
        }
        tokens.push({ start, end, type: rule.type, text });
      }
    });

    tokens.sort((a, b) => a.start - b.start);
    let cursor = 0;
    let html = "";
    tokens.forEach(token => {
      if (cursor < token.start) {
        html += escapeHtml(source.slice(cursor, token.start));
      }
      html += `<span class="tok-${token.type}">${escapeHtml(token.text)}</span>`;
      cursor = token.end;
    });
    if (cursor < source.length) {
      html += escapeHtml(source.slice(cursor));
    }
    return html;
  }

  function isLikelyUnsupportedScriban(templateBody, message) {
    return (
      /\|\s*[A-Za-z_]/.test(templateBody) ||
      /\bstring\.[A-Za-z_]/.test(templateBody) ||
      /\barray\.[A-Za-z_]/.test(templateBody) ||
      /\bnumber\.[A-Za-z_]/.test(templateBody) ||
      /\bdate\.(to_string|add_days)\b/.test(templateBody) ||
      /\bempty\s+/.test(templateBody) ||
      /\bdefault\s+/.test(templateBody) ||
      /\bis not a function\b/.test(message) ||
      /\bUnexpected identifier\b/.test(message)
    );
  }

  function tokenizeTemplate(templateText) {
    const tokens = [];
    let cursor = 0;
    while (cursor < templateText.length) {
      const start = templateText.indexOf("{{", cursor);
      if (start === -1) {
        tokens.push({ type: "text", value: templateText.slice(cursor) });
        break;
      }
      if (start > cursor) tokens.push({ type: "text", value: templateText.slice(cursor, start) });
      const end = templateText.indexOf("}}", start + 2);
      if (end === -1) throw new Error("Unclosed template tag.");
      tokens.push({ type: "tag", value: templateText.slice(start + 2, end).trim() });
      cursor = end + 2;
    }
    return tokens;
  }

  function TemplateCompiler() {
    this.code = ["let __out = \"\";"];
    this.loopStack = [];
    this.blockStack = [];
    this.counter = 0;
  }

  TemplateCompiler.prototype.compile = function (tokens) {
    tokens.forEach(token => {
      if (token.type === "text") {
        if (token.value) this.code.push(`__out += ${JSON.stringify(token.value)};`);
        return;
      }
      this.processTag(token.value);
    });
    if (this.blockStack.length > 0) {
      throw new Error(`Unclosed template block: expected {{ end }} for ${this.blockStack[this.blockStack.length - 1].type}.`);
    }
    this.code.push("return __out;");
    return this.code.join("\n");
  };

  TemplateCompiler.prototype.processTag = function (tag) {
    if (/^for\s+/i.test(tag)) {
      const match = tag.match(/^for\s+([A-Za-z_][A-Za-z0-9_]*)\s+in\s+(.+)$/i);
      if (!match) throw new Error(`Invalid for expression: ${tag}`);
      const itemName = match[1];
      const loopVar = `__loop${this.counter++}`;
      const arrayVar = `__array${this.counter++}`;
      const indexVar = `__index${this.counter++}`;
      const jsExpr = this.transformExpression(match[2], loopVar);
      this.code.push(`const ${arrayVar} = __toArray(${jsExpr});`);
      this.code.push(`for (let ${indexVar} = 0; ${indexVar} < ${arrayVar}.length; ${indexVar} += 1) {`);
      this.code.push(`const ${itemName} = ${arrayVar}[${indexVar}];`);
      this.code.push(`const ${loopVar} = { index: ${indexVar}, first: ${indexVar} === 0, last: ${indexVar} === ${arrayVar}.length - 1 };`);
      this.loopStack.push(loopVar);
      this.blockStack.push({ type: "loop" });
      return;
    }
    if (/^if\s+/i.test(tag)) {
      this.code.push(`if (${this.transformExpression(tag.replace(/^if\s+/i, ""))}) {`);
      this.blockStack.push({ type: "if", elseSeen: false });
      return;
    }
    if (/^else if\s+/i.test(tag)) {
      const currentBlock = this.blockStack[this.blockStack.length - 1];
      if (!currentBlock || currentBlock.type !== "if") {
        throw new Error("Unexpected {{ else if }} without a matching {{ if }}.");
      }
      if (currentBlock.elseSeen) {
        throw new Error("Unexpected {{ else if }} after {{ else }}.");
      }
      this.code.push(`} else if (${this.transformExpression(tag.replace(/^else if\s+/i, ""))}) {`);
      return;
    }
    if (/^else$/i.test(tag)) {
      const currentBlock = this.blockStack[this.blockStack.length - 1];
      if (!currentBlock || currentBlock.type !== "if") {
        throw new Error("Unexpected {{ else }} without a matching {{ if }}.");
      }
      if (currentBlock.elseSeen) {
        throw new Error("Unexpected second {{ else }} in the same {{ if }} block.");
      }
      currentBlock.elseSeen = true;
      this.code.push("} else {");
      return;
    }
    if (/^end$/i.test(tag)) {
      const blockType = this.blockStack.pop();
      if (!blockType) {
        throw new Error("Unexpected {{ end }} without an open block.");
      }
      if (blockType.type === "loop" && this.loopStack.length > 0) this.loopStack.pop();
      this.code.push("}");
      return;
    }
    this.code.push(`__out += __stringify(${this.transformExpression(tag)});`);
  };

  TemplateCompiler.prototype.transformExpression = function (expression, explicitLoopVar) {
    const loopVar = explicitLoopVar || this.loopStack[this.loopStack.length - 1] || "__loop";
    let expr = String(expression).trim().replace(/\bfor\./g, `${loopVar}.`);
    expr = transformPipedExpression(expr);
    expr = transformFunctionStyleExpression(expr);
    validateTemplateExpression(expr);
    return expr;
  };

  function validateTemplateExpression(expression) {
    const value = String(expression || "").trim();
    if (!value) return;

    const blockedPatterns = [
      { regex: /[`;]/, message: "Unsafe characters are not allowed in expressions." },
      { regex: /\b(new|function|class|const|let|var|return|try|catch|finally|throw|while|do|switch|delete)\b/, message: "Only template expressions are supported here." },
      { regex: /=>/, message: "Arrow functions are not supported in template expressions." },
      { regex: /\b(window|document|globalThis|global|self|Function|eval|fetch|XMLHttpRequest|localStorage|sessionStorage|navigator|location|history|process|require|module|Object|Reflect|Proxy)\b/, message: "Global APIs are not available inside templates." },
      { regex: /\bconstructor\b|__proto__|\bprototype\b/, message: "Prototype access is not allowed inside templates." }
    ];

    for (const blocked of blockedPatterns) {
      if (blocked.regex.test(value)) throw new Error(blocked.message);
    }

    if (hasAssignmentOutsideComparison(value)) {
      throw new Error("Assignment is not allowed inside template expressions.");
    }

    if (hasBlockedMutationCall(value)) {
      throw new Error("Mutating method calls are not allowed inside template expressions.");
    }
  }

  function hasAssignmentOutsideComparison(value) {
    let quote = "";
    let depth = 0;

    for (let index = 0; index < value.length; index += 1) {
      const char = value[index];
      const previous = index > 0 ? value[index - 1] : "";
      const next = value[index + 1] || "";

      if (quote) {
        if (char === quote && previous !== "\\") quote = "";
        continue;
      }

      if (char === "'" || char === "\"") {
        quote = char;
        continue;
      }

      if (char === "(" || char === "[" || char === "{") {
        depth += 1;
        continue;
      }

      if (char === ")" || char === "]" || char === "}") {
        depth = Math.max(0, depth - 1);
        continue;
      }

      if (depth !== 0 || char !== "=") continue;

      if (previous === "=" || previous === "!" || previous === "<" || previous === ">") continue;
      if (next === "=" || next === ">") continue;
      return true;
    }

    return false;
  }

  function hasBlockedMutationCall(value) {
    const blockedMethods = [
      "copyWithin", "fill", "pop", "push", "reverse", "shift",
      "sort", "splice", "unshift"
    ];
    const pattern = new RegExp(`\\.(${blockedMethods.join("|")})\\s*\\(`);
    return pattern.test(String(value || ""));
  }

  function transformPipedExpression(expression) {
    const segments = splitTopLevel(expression, "|");
    if (segments.length <= 1) return expression;

    let current = transformFunctionStyleExpression(segments[0].trim());
    for (let index = 1; index < segments.length; index += 1) {
      const pipe = segments[index].trim();
      if (!pipe) continue;

      const parsed = parsePipeSegment(pipe);
      const argCode = parsed.args.length ? `, [${parsed.args.join(", ")}]` : ", []";
      current = `__applyPipe(${current}, ${JSON.stringify(parsed.name)}${argCode})`;
    }
    return current;
  }

  function transformFunctionStyleExpression(expression) {
    const trimmed = String(expression).trim();
    const match = trimmed.match(/^(empty|default|string\.format)\s+(.+)$/);
    if (!match) return trimmed;
    const helperName = match[1];
    const args = parseArgumentList(match[2]);
    return `__callHelper(${JSON.stringify(helperName)}, [${args.join(", ")}])`;
  }

  function parsePipeSegment(segment) {
    const trimmed = String(segment || "").trim();
    const firstSpace = indexOfTopLevelWhitespace(trimmed);
    if (firstSpace === -1) return { name: trimmed, args: [] };
    return {
      name: trimmed.slice(0, firstSpace).trim(),
      args: parseArgumentList(trimmed.slice(firstSpace + 1).trim())
    };
  }

  function parseArgumentList(text) {
    const trimmed = String(text || "").trim();
    if (!trimmed) return [];
    return splitTopLevel(trimmed, ",", true).map(part => part.trim()).filter(Boolean);
  }

  function splitTopLevel(text, separator, splitWhitespaceLikeComma) {
    const parts = [];
    let current = "";
    let quote = "";
    let depth = 0;

    for (let index = 0; index < text.length; index += 1) {
      const char = text[index];
      const previous = index > 0 ? text[index - 1] : "";

      if (quote) {
        current += char;
        if (char === quote && previous !== "\\") quote = "";
        continue;
      }

      if (char === "'" || char === "\"") {
        quote = char;
        current += char;
        continue;
      }

      if (char === "(" || char === "[" || char === "{") {
        depth += 1;
        current += char;
        continue;
      }

      if (char === ")" || char === "]" || char === "}") {
        depth = Math.max(0, depth - 1);
        current += char;
        continue;
      }

      if (depth === 0 && separator === "|" && char === "|") {
        if (text[index + 1] === "|") {
          current += "||";
          index += 1;
          continue;
        }
        parts.push(current);
        current = "";
        continue;
      }

      if (depth === 0 && separator === "," && char === ",") {
        parts.push(current);
        current = "";
        continue;
      }

      if (depth === 0 && splitWhitespaceLikeComma && /\s/.test(char)) {
        const nextChar = text[index + 1] || "";
        if (current.trim() && nextChar && !/[,\s]/.test(nextChar)) {
          parts.push(current);
          current = "";
          continue;
        }
      }

      current += char;
    }

    if (current) parts.push(current);
    return parts;
  }

  function indexOfTopLevelWhitespace(text) {
    let quote = "";
    let depth = 0;

    for (let index = 0; index < text.length; index += 1) {
      const char = text[index];
      const previous = index > 0 ? text[index - 1] : "";

      if (quote) {
        if (char === quote && previous !== "\\") quote = "";
        continue;
      }

      if (char === "'" || char === "\"") {
        quote = char;
        continue;
      }

      if (char === "(" || char === "[" || char === "{") {
        depth += 1;
        continue;
      }

      if (char === ")" || char === "]" || char === "}") {
        depth = Math.max(0, depth - 1);
        continue;
      }

      if (depth === 0 && /\s/.test(char)) return index;
    }

    return -1;
  }

  const helperMethods = {
    "string.lower": value => String(value == null ? "" : value).toLowerCase(),
    "string.upper": value => String(value == null ? "" : value).toUpperCase(),
    "string.capitalize": value => {
      const text = String(value == null ? "" : value);
      return text ? text.charAt(0).toUpperCase() + text.slice(1).toLowerCase() : "";
    },
    "string.trim": value => String(value == null ? "" : value).trim(),
    "string.replace": (value, searchValue, replaceValue) => String(value == null ? "" : value).split(String(searchValue)).join(String(replaceValue)),
    "string.contains": (value, searchValue) => String(value == null ? "" : value).includes(String(searchValue)),
    "string.starts_with": (value, searchValue) => String(value == null ? "" : value).startsWith(String(searchValue)),
    "string.ends_with": (value, searchValue) => String(value == null ? "" : value).endsWith(String(searchValue)),
    "string.split": (value, separatorValue) => String(value == null ? "" : value).split(separatorValue == null ? "" : String(separatorValue)),
    "string.substr": (value, start, length) => String(value == null ? "" : value).substr(Number(start) || 0, length === undefined ? undefined : Number(length)),
    "string.length": value => String(value == null ? "" : value).length,
    "string.format": function () {
      const args = Array.prototype.slice.call(arguments);
      const formatValue = args.shift();
      const formatString = String(formatValue == null ? "" : formatValue);
      return formatString.replace(/\{(\d+)\}/g, function (_, group) {
        return args[Number(group)] == null ? "" : String(args[Number(group)]);
      });
    },
    "array.size": value => (Array.isArray(value) ? value.length : 0),
    "array.first": value => (Array.isArray(value) && value.length ? value[0] : null),
    "array.last": value => (Array.isArray(value) && value.length ? value[value.length - 1] : null),
    "array.sort": value => (Array.isArray(value) ? value.slice().sort() : []),
    "array.join": (value, separatorValue) => (Array.isArray(value) ? value.join(separatorValue == null ? "," : String(separatorValue)) : ""),
    "array.contains": (value, expected) => (Array.isArray(value) ? value.includes(expected) : false),
    "array.index_of": (value, expected) => (Array.isArray(value) ? value.indexOf(expected) : -1),
    "array.reverse": value => (Array.isArray(value) ? value.slice().reverse() : []),
    "number.abs": value => Math.abs(Number(value) || 0),
    "number.floor": value => Math.floor(Number(value) || 0),
    "number.ceil": value => Math.ceil(Number(value) || 0),
    "number.round": value => Math.round(Number(value) || 0),
    "number.format": (value, pattern) => {
      const decimals = String(pattern || "").includes(".") ? String(pattern).split(".")[1].length : 0;
      return Number(value || 0).toFixed(decimals);
    },
    "date.to_string": (value, pattern) => formatDateValue(value, pattern),
    "date.add_days": (value, days) => {
      const dateValue = toDate(value);
      dateValue.setDate(dateValue.getDate() + (Number(days) || 0));
      return dateValue;
    },
    "default": (value, fallback) => {
      if (value === null || value === undefined || value === "" || (Array.isArray(value) && value.length === 0)) return fallback;
      return value;
    },
    "empty": value => value === null || value === undefined || value === "" || (Array.isArray(value) && value.length === 0)
  };

  const templateHelpers = {
    __toArray(value) {
      return Array.isArray(value) ? value : [];
    },
    __stringify(value) {
      if (value === null || value === undefined) return "";
      if (value instanceof Date) return formatDateValue(value, "yyyy-MM-ddTHH:mm:ss");
      if (Array.isArray(value)) return value.join(", ");
      return String(value);
    },
    __applyPipe(value, pipeName, args) {
      if (!helperMethods[pipeName]) throw new Error(`Unsupported helper: ${pipeName}`);
      return helperMethods[pipeName].apply(null, [value].concat(args || []));
    },
    __callHelper(helperName, args) {
      if (!helperMethods[helperName]) throw new Error(`Unsupported helper: ${helperName}`);
      return helperMethods[helperName].apply(null, args || []);
    }
  };

  function parseTypeArgs(value) {
    return String(value || "").trim().split(",").map(part => part.trim()).filter(Boolean);
  }

  function getPrimaryField(fields) {
    const items = Array.isArray(fields) ? fields : [];
    return items.find(field => field.IsPrimaryKey) || items.find(field => field.IsAutoIncrement) || items[0] || null;
  }

  function normalizeSqlType(value) {
    return String(value || "").toLowerCase().replace(/\(.*/, "");
  }

  function extractTypeArgs(value) {
    const match = String(value || "").match(/\(([^)]*)\)/);
    return match ? match[1] : "";
  }

  function mapSqlTypeToJs(dataTypeName, typeArgs) {
    const firstArg = Number(typeArgs[0] || 0);
    const secondArg = Number(typeArgs[1] || 0);
    const isLong = /max/i.test(typeArgs[0] || "");
    const type = dataTypeName.toLowerCase();
    const map = {
      int: "int", bigint: "long", smallint: "short", tinyint: "byte", bit: "bool",
      uniqueidentifier: "Guid", datetime: "DateTime", datetime2: "DateTime", date: "DateTime",
      decimal: "decimal", numeric: "decimal", float: "double", real: "float",
      money: "decimal", smallmoney: "decimal", varchar: "string", nvarchar: "string",
      char: "string", nchar: "string", text: "string", ntext: "string", xml: "string",
      varbinary: "byte[]", binary: "byte[]"
    };
    const keywordDataType = map[type] || "object";
    return {
      keywordDataType,
      columnSize: firstArg || 0,
      numericPrecision: firstArg || 0,
      numericScale: secondArg || 0,
      isLong,
      rawTypeArgs: typeArgs.join(","),
      canBeNullable: ["DateTime", "int", "decimal", "bool", "double", "float", "Guid", "long", "short", "byte"].includes(keywordDataType)
    };
  }

  function buildSqlDataType(dataTypeName, meta) {
    const type = dataTypeName.toLowerCase();
    if (["varchar", "nvarchar", "varbinary", "char", "nchar"].includes(type)) return `${type}(${meta.isLong ? "MAX" : meta.columnSize || 50})`;
    if (["decimal", "numeric"].includes(type)) return `${type}(${meta.numericPrecision || 18},${meta.numericScale || 0})`;
    if (meta.rawTypeArgs) return `${type}(${meta.rawTypeArgs})`;
    return type;
  }

  function toReadableName(value) {
    return String(value || "")
      .replace(/[_\-]+/g, " ")
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\b\w/g, function (char) { return char.toUpperCase(); });
  }

  function parseTableIdentifier(value) {
    const cleaned = String(value || "").trim().replace(/[\[\]]/g, "");
    const parts = cleaned.split(".").filter(Boolean);
    if (parts.length === 1) return { schema: "dbo", name: parts[0], qualifiedName: `dbo.${parts[0]}` };
    const schema = parts[parts.length - 2] || "dbo";
    const name = parts[parts.length - 1] || "Sample";
    return { schema, name, qualifiedName: `${schema}.${name}` };
  }

  function extractPrimaryKeyColumns(text) {
    const columns = new Set();
    const source = String(text || "").replace(/\r\n/g, "\n");
    const regex = /primary\s+key(?:\s+\w+)*(?:\s*\([^)]+\))?[\s\S]*?\(([\s\S]*?)\)/ig;
    let match;

    while ((match = regex.exec(source)) !== null) {
      const inner = String(match[1] || "");
      inner.split(",").forEach(part => {
        const columnMatch = part.match(/\[?([A-Za-z0-9_]+)\]?/);
        if (columnMatch) columns.add(columnMatch[1].toLowerCase());
      });
    }

    return columns;
  }

  function sanitizeTypeName(value) {
    const lastPart = String(value || "").replace(/[\[\]]/g, "").split(".").filter(Boolean).pop() || "Sample";
    return lastPart.replace(/[^A-Za-z0-9_]/g, "_");
  }

  function mapRouteConstraint(typeName) {
    const map = { int: "int", long: "long", Guid: "guid", bool: "bool", float: "float", double: "double", decimal: "decimal" };
    return map[typeName] || "";
  }

  function toDate(value) {
    if (value instanceof Date) return new Date(value.getTime());
    return new Date(value || Date.now());
  }

  function formatDateValue(value, pattern) {
    const dateValue = toDate(value);
    const pad = function (number) { return String(number).padStart(2, "0"); };
    const tokens = {
      yyyy: dateValue.getFullYear(),
      MM: pad(dateValue.getMonth() + 1),
      dd: pad(dateValue.getDate()),
      HH: pad(dateValue.getHours()),
      mm: pad(dateValue.getMinutes()),
      ss: pad(dateValue.getSeconds())
    };
    let output = pattern || "yyyy-MM-ddTHH:mm:ss";
    Object.keys(tokens).forEach(function (token) {
      output = output.replace(new RegExp(token, "g"), String(tokens[token]));
    });
    return output;
  }

  function createId(value) {
    return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "template";
  }

  function fileNameWithoutExtension(path) {
    return (String(path || "").split(/[\\/]/).pop() || "template").replace(/\.[^.]+$/, "");
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
})();
