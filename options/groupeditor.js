/** ***** BEGIN LICENSE BLOCK *****
 *
 *  Copyright (C) 2017 Marc Ruiz Altisent. All rights reserved.
 *
 *  This file is part of FoxReplace.
 *
 *  FoxReplace is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software
 *  Foundation, either version 3 of the License, or (at your option) any later version.
 *
 *  FoxReplace is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
 *  A PARTICULAR PURPOSE. See the GNU General Public License for more details.
 *
 *  You should have received a copy of the GNU General Public License along with FoxReplace. If not, see <http://www.gnu.org/licenses/>.
 *
 *  ***** END LICENSE BLOCK ***** */

/**
 * Substitution group editor.
 */
var groupEditor = (() => {

  /**
   *  Characters to replace by entities to show them in the grid.
   */
  var entityMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
    '/': '&#x2F;',
    '`': '&#x60;',
    '=': '&#x3D;',
    ' ': '&nbsp;'
  };

  let adjustedUrlsColumnWidths = false;
  let adjustedSubstitutionsColumnWidths = false;

  /**
   *  Returns the given string with special characters replaced by entities.
   */
  function escapeHtml(string) {
    return String(string).replace(/[&<>"'`=\/ ]/g, function (s) {
      return entityMap[s];
    });
  }

  /**
   *  Returns true if the row defined by params is the last row and false otherwise.
   */
  function isLastRow(params) {
    let rowIndex = params.rowIndex || params.node && params.node.rowIndex;
    let rowModel = params.api && params.api.getModel() || params.node && params.node.rowModel || params.rowModel;
    return rowIndex == rowModel.getRowCount() - 1;
  }

  /**
   *  Options for the URLs grid.
   */
  var urlsGridOptions = {

    headerHeight: 0,
    rowSelection: "single",

    columnDefs: [
      {
        field: "url",
        editable: true,
        cellClassRules: {
          placeholder(params) {
            return params.value === "";
          },
          exclusionUrl(params) {
            return isExclusionUrl(params.data.url);
          }
        },
        cellRenderer(params) {
          return params.value === "" ? browser.i18n.getMessage("list.urlHint") : params.value;
        }//,
        //onCellValueChanged(params) {
        //  // TODO to use this instead of onCellEditingStopped change params.value -> params.newValue and params.rowIndex -> params.node.rowIndex
        //}
      },
      {
        field: "url",
        width: 40,
        cellRenderer: DeleteButtonCellRenderer,
        suppressSizeToFit: true
      }
    ],

    onCellEditingStopped(params) {
      let isLast = isLastRow(params);
      let isEmpty = params.value === "";

      if (!isLast && isEmpty) {
        params.api.updateRowData({ remove: [params.data] });
      }
      else if (isLast && !isEmpty) {
        params.api.updateRowData({ add: [{ url: "" }] });
      }

      // TODO si s'ha fet enter i no (és l'últim i el deixem buit) -> focus a la fila següent
    },

    onCellFocused(params) {
      if (params.rowIndex === null) return; // Safety check needed in ag-Grid 14.2.0
      this.api.getModel().getRow(params.rowIndex).setSelected(true);
    }

  };

  /**
   *  Options for the substitutions grid.
   */
  var substitutionsGridOptions = {

    enableColResize: true,
    //enableSorting: true,
    //enableFilter: true,
    editType: "fullRow",
    rowSelection: "single",

    defaultColDef: {
      editable: true,
      cellClassRules: {
        placeholder(params) {
          return params.data.input === "";
        }
      }
    },

    columnDefs: [
      {
        headerName: browser.i18n.getMessage("list.inputHeader"),
        field: "input",
        cellRenderer(params) {
          return params.value === "" ? browser.i18n.getMessage("list.inputHint") : escapeHtml(params.value);
        }
      },
      {
        headerName: browser.i18n.getMessage("list.inputTypeHeader"),
        field: "inputType",
        cellRenderer(params) {  // TODO improve (less hardcoding)
          switch (Number(params.value)) {
            case 0: return browser.i18n.getMessage("inputType.text");
            case 1: return browser.i18n.getMessage("inputType.wholeWords");
            case 2: return browser.i18n.getMessage("inputType.regExp");
            default: return params.value;
          }
        },
        cellEditor: InputTypeEditor
      },
      {
        headerName: browser.i18n.getMessage("list.outputHeader"),
        field: "output",
        cellRenderer(params) {
          return params.data.input === "" ? browser.i18n.getMessage("list.outputHint") : escapeHtml(params.value);
        }
      },
      {
        headerName: browser.i18n.getMessage("list.caseSensitiveHeader"),
        field: "caseSensitive",
        cellRenderer(params) {
          return params.value ? browser.i18n.getMessage("yes") : browser.i18n.getMessage("no");
        },
        cellEditor: CheckboxCellEditor
      },
      {
        headerName: "",
        field: "input",
        width: 40,
        cellRenderer: DeleteButtonCellRenderer,
        suppressSizeToFit: true,
        editable: false
      }
    ],

    onRowEditingStopped(params) {
      let isLast = isLastRow(params);
      let isEmpty = params.data.input === "";

      if (!isLast && isEmpty) {
        params.api.updateRowData({ remove: [params.data] });
      }
      else if (isLast && !isEmpty) {
        params.api.updateRowData({ add: [{ input: "", inputType: 0, output: "", caseSensitive: false }] });
      }

      // TODO si s'ha fet enter i no (és l'últim i el deixem buit) -> focus a la fila següent
    },

    onCellFocused(params) {
      if (params.rowIndex === null) return; // Safety check needed in ag-Grid 14.2.0
      this.api.getModel().getRow(params.rowIndex).setSelected(true);
    },

    tabToNextCell(params) {
      if (params.editing && params.nextCellDef == null) {
        substitutionsGridOptions.api.stopEditing();
        if (!params.backwards && params.previousCellDef.rowIndex < substitutionsGridOptions.api.getModel().getRowCount() - 1) { // if a new row has been added
          params.previousCellDef.rowIndex++;
        }
        params.previousCellDef.column = substitutionsGridOptions.columnApi.getColumn("input");
        return params.previousCellDef;
        // TODO allow to edit a new row
      }
      else {
        return params.nextCellDef;
      }
    }
  };

  var urlsEventListeners = {
    onShow(event) {
      document.getElementById("urlsGrid").removeEventListener("show", urlsEventListeners.onShow);
      urlsGridOptions.api.sizeColumnsToFit();
    },
    onKeyUp(event) {
      if (event.key == "Escape") event.stopPropagation();
    },
    onKeyDown(event) {
      if (event.key == "Delete") {
        let api = urlsGridOptions.api;
        if (!api.getSelectedNodes()) return;
        let selectedNode = api.getSelectedNodes()[0];
        if (selectedNode.rowIndex != selectedNode.rowModel.getRowCount() - 1) { // no last row
          api.updateRowData({ remove: api.getSelectedRows() });
        }
        event.stopPropagation();
      }
    },
    clear() {
      editor.clearUrls();
    }
  };

  function addUrlsEventListeners() {
    document.getElementById("urlsGrid").addEventListener("show", urlsEventListeners.onShow);
    document.getElementById("urlsGrid").addEventListener("keyup", urlsEventListeners.onKeyUp);
    document.getElementById("urlsGrid").addEventListener("keydown", urlsEventListeners.onKeyDown, true);
    document.getElementById("clearUrlsButton").addEventListener("click", urlsEventListeners.clear);
  }

  function removeUrlsEventListeners() {
    document.getElementById("urlsGrid").removeEventListener("keyup", urlsEventListeners.onKeyUp);
    document.getElementById("urlsGrid").removeEventListener("keydown", urlsEventListeners.onKeyDown, true);
    document.getElementById("clearUrlsButton").removeEventListener("click", urlsEventListeners.clear);
  }

  var substitutionsEventListeners = {
    onKeyUp(event) {
      if (event.key == "Escape") event.stopPropagation();
    },
    onKeyDown(event) {
      if (event.key == "Delete") {
        let api = substitutionsGridOptions.api;
        if (!api.getSelectedNodes()) return;
        let selectedNode = api.getSelectedNodes()[0];
        if (selectedNode.rowIndex != selectedNode.rowModel.getRowCount() - 1) { // no last row
          api.updateRowData({ remove: api.getSelectedRows() });
        }
        event.stopPropagation();
      }
      else if (event.key == "ArrowUp" || event.key == "ArrowDown") {   // TODO avoid changing cell and exit edit mode if we are in the select and the user presses arrow up or down
        if ($(".inputTypeEditorFocused").length > 0) {
          let e = $.Event("keydown", { which: event.which });
          $(".inputTypeEditorFocused").trigger(e);
          event.stopPropagation();
          event.preventDefault();
        }
      }
    },
    moveTop() {
      let api = substitutionsGridOptions.api;
      let selectedNode = substitutionsEventListeners._getSelectedNode();
      if (selectedNode && !isLastRow(selectedNode)) {
        let data = selectedNode.data;
        api.updateRowData({ remove: [data] });
        api.updateRowData({ add: [data], addIndex: 0});
        api.setFocusedCell(0);
      }
    },
    moveUp() {
      let api = substitutionsGridOptions.api;
      let selectedNode = substitutionsEventListeners._getSelectedNode();
      if (selectedNode && !isLastRow(selectedNode)) {
        let data = selectedNode.data;
        let newIndex = Math.max(selectedNode.rowIndex - 1, 0);
        api.updateRowData({ remove: [data] });
        api.updateRowData({ add: [data], addIndex: newIndex});
        api.setFocusedCell(newIndex);
      }
    },
    moveDown() {
      let api = substitutionsGridOptions.api;
      let selectedNode = substitutionsEventListeners._getSelectedNode();
      if (selectedNode && !isLastRow(selectedNode)) {
        let data = selectedNode.data;
        let newIndex = Math.min(selectedNode.rowIndex + 1, selectedNode.rowModel.getRowCount() - 2);
        api.updateRowData({ remove: [data] });
        api.updateRowData({ add: [data], addIndex: newIndex});
        api.setFocusedCell(newIndex);
      }
    },
    moveBottom() {
      let api = substitutionsGridOptions.api;
      let selectedNode = substitutionsEventListeners._getSelectedNode();
      if (selectedNode && !isLastRow(selectedNode)) {
        let data = selectedNode.data;
        let newIndex = selectedNode.rowModel.getRowCount() - 2;
        api.updateRowData({ remove: [data] });
        api.updateRowData({ add: [data], addIndex: newIndex});
        api.setFocusedCell(newIndex);
      }
    },
    clear() {
      editor.clearSubstitutions();
    },
    _getSelectedNode() {
      let api = substitutionsGridOptions.api;
      if (!api.getSelectedNodes()) return null;
      else return api.getSelectedNodes()[0];
    }
  };

  function addSubstitutionsEventListeners() {
    document.getElementById("substitutionsGrid").addEventListener("keyup", substitutionsEventListeners.onKeyUp);
    document.getElementById("substitutionsGrid").addEventListener("keydown", substitutionsEventListeners.onKeyDown, true);
    document.getElementById("moveTopSubstitutionButton").addEventListener("click", substitutionsEventListeners.moveTop);
    document.getElementById("moveUpSubstitutionButton").addEventListener("click", substitutionsEventListeners.moveUp);
    document.getElementById("moveDownSubstitutionButton").addEventListener("click", substitutionsEventListeners.moveDown);
    document.getElementById("moveBottomSubstitutionButton").addEventListener("click", substitutionsEventListeners.moveBottom);
    document.getElementById("clearSubstitutionsButton").addEventListener("click", substitutionsEventListeners.clear);
  }

  function removeSubstitutionsEventListeners() {
    document.getElementById("substitutionsGrid").removeEventListener("keyup", substitutionsEventListeners.onKeyUp);
    document.getElementById("substitutionsGrid").removeEventListener("keydown", substitutionsEventListeners.onKeyDown, true);
    document.getElementById("moveTopSubstitutionButton").removeEventListener("click", substitutionsEventListeners.moveTop);
    document.getElementById("moveUpSubstitutionButton").removeEventListener("click", substitutionsEventListeners.moveUp);
    document.getElementById("moveDownSubstitutionButton").removeEventListener("click", substitutionsEventListeners.moveDown);
    document.getElementById("moveBottomSubstitutionButton").removeEventListener("click", substitutionsEventListeners.moveBottom);
    document.getElementById("clearSubstitutionsButton").removeEventListener("click", substitutionsEventListeners.clear);
  }

  var editor = {

    init() {
      this.initUrls();
      this.initSubstitutions();
    },

    initUrls() {
      let grid = document.getElementById("urlsGrid");
      new agGrid.Grid(grid, urlsGridOptions);
      addUrlsEventListeners();
    },

    initSubstitutions() {
      let grid = document.getElementById("substitutionsGrid");
      new agGrid.Grid(grid, substitutionsGridOptions);
      addSubstitutionsEventListeners();
    },

    cleanUp() {
      removeUrlsEventListeners();
      removeSubstitutionsEventListeners();
    },

    clear() {
      this.isEditing = false;

      $("#groupEditor").form("clear");
      $("#groupEditor").form("set value", "enabled", true);
      $("#groupEditor .ui.dropdown").dropdown("set selected", "0"); // for mode and HTML options
      this.clearUrls();
      this.clearSubstitutions();
    },

    clearUrls() {
      urlsGridOptions.api.setRowData([{ url: "" }]);
    },

    clearSubstitutions() {
      substitutionsGridOptions.api.setRowData([{ input: "", inputType: 0, output: "", caseSensitive: false }]);
    },

    setGroup(group) {
      this.isEditing = true;

      $("#groupEditor .ui.dropdown").dropdown("set selected", "0"); // for mode and HTML options
      $("#groupEditor").form("set values", { enabled: group.enabled, mode: group.mode, name: group.name, html: group.html });

      let urls = group.urls.map(u => ({ url: u}));
      urls.push({ url: "" });
      urlsGridOptions.api.setRowData(urls);

      let substitutions = group.substitutions.map(s => s);  // shallow copy
      substitutions.push({ input: "", inputType: 0, output: "", caseSensitive: false });
      substitutionsGridOptions.api.setRowData(substitutions);
    },

    getGroup() {
      let {enabled, mode, name, html} = $("#groupEditor").form("get values", ["enabled", "mode", "name", "html"]);

      let urls = [];
      urlsGridOptions.api.forEachNode(node => {
        if (node.data.url) urls.push(node.data.url);
      });

      let substitutions = [];
      substitutionsGridOptions.api.forEachNode(node => {
        if (node.data.input) substitutions.push(new Substitution(node.data.input, node.data.output, node.data.caseSensitive, node.data.inputType));
      });

      return new SubstitutionGroup(name, urls, substitutions, html, enabled, mode);
    },

    isValidGroup() {
      return substitutionsGridOptions.api.getModel().getRowCount() > 1;
    },

    adjustUrlsColumnWidths() {
      if (!adjustedUrlsColumnWidths) {
        urlsGridOptions.api.sizeColumnsToFit();
        adjustedUrlsColumnWidths = true;
      }
    },

    adjustSubstitutionsColumnWidths() {
      if (!adjustedSubstitutionsColumnWidths) {
        substitutionsGridOptions.api.sizeColumnsToFit();
        adjustedSubstitutionsColumnWidths = true;
      }
    }

  };

  return editor;

})();

// TODO home and end keys while editing
// TODO don't allow to close modal by clicking outside if there are pending changes
