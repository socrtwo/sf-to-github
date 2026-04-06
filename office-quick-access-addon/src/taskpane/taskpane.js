/*
 * Office Quick Access Add-in - Task Pane
 *
 * This provides a visual panel with buttons for all QAT-style commands.
 * It serves as an alternative to the ribbon dropdown, especially useful
 * on platforms where custom ribbon commands may not render.
 */

/* global Office, Word, Excel */

(function () {
  "use strict";

  // Toast notification
  var toastEl;
  var toastTimer;

  function showToast(msg) {
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.className = "toast";
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toastEl.classList.remove("show");
    }, 2500);
  }

  // Collapsible sections
  function setupCollapsibles() {
    document.querySelectorAll(".section-title[data-toggle]").forEach(function (title) {
      title.addEventListener("click", function () {
        var targetId = title.getAttribute("data-toggle");
        var target = document.getElementById(targetId);
        if (target) {
          var isCollapsed = target.classList.toggle("collapsed");
          title.classList.toggle("collapsed", isCollapsed);
        }
      });
    });
  }

  // Command dispatcher
  var commands = {
    save: function () {
      Office.context.document.save(Office.AsyncResultStatus || {}, function (result) {
        if (result.status === Office.AsyncResultStatus.Failed) {
          showToast("Save failed: " + result.error.message);
        } else {
          showToast("Saved!");
        }
      });
    },

    print: function () {
      showToast("Use Ctrl+P / Cmd+P to print.");
    },

    undo: function () {
      showToast("Use Ctrl+Z / Cmd+Z to undo.");
    },

    redo: function () {
      showToast("Use Ctrl+Y / Cmd+Shift+Z to redo.");
    },

    selectAll: function () {
      if (Office.context.host === Office.HostType.Word) {
        Word.run(function (ctx) {
          ctx.document.body.getRange().select();
          return ctx.sync();
        }).then(function () {
          showToast("All selected.");
        }).catch(function (err) {
          showToast("Error: " + err.message);
        });
      } else {
        showToast("Use Ctrl+A / Cmd+A.");
      }
    },

    // Format toggles
    bold: function () { toggleFont("bold"); },
    italic: function () { toggleFont("italic"); },
    strikethrough: function () { toggleFont("strikethrough"); },

    underline: function () {
      if (Office.context.host === Office.HostType.Word) {
        Word.run(function (ctx) {
          var sel = ctx.document.getSelection();
          sel.font.load("underline");
          return ctx.sync().then(function () {
            sel.font.underline = sel.font.underline === "None" ? "Single" : "None";
            return ctx.sync();
          });
        }).then(function () {
          showToast("Underline toggled.");
        }).catch(function (err) {
          showToast("Error: " + err.message);
        });
      } else {
        toggleFont("underline");
      }
    },

    superscript: function () {
      if (Office.context.host === Office.HostType.Word) {
        Word.run(function (ctx) {
          var sel = ctx.document.getSelection();
          sel.font.load("superscript");
          return ctx.sync().then(function () {
            sel.font.superscript = !sel.font.superscript;
            return ctx.sync();
          });
        }).then(function () {
          showToast("Superscript toggled.");
        }).catch(function (err) {
          showToast("Error: " + err.message);
        });
      } else {
        showToast("Superscript not available for this app.");
      }
    },

    subscript: function () {
      if (Office.context.host === Office.HostType.Word) {
        Word.run(function (ctx) {
          var sel = ctx.document.getSelection();
          sel.font.load("subscript");
          return ctx.sync().then(function () {
            sel.font.subscript = !sel.font.subscript;
            return ctx.sync();
          });
        }).then(function () {
          showToast("Subscript toggled.");
        }).catch(function (err) {
          showToast("Error: " + err.message);
        });
      } else {
        showToast("Subscript not available for this app.");
      }
    },

    // Font sizes
    fontSize8: function () { setFontSize(8); },
    fontSize10: function () { setFontSize(10); },
    fontSize11: function () { setFontSize(11); },
    fontSize12: function () { setFontSize(12); },
    fontSize14: function () { setFontSize(14); },
    fontSize16: function () { setFontSize(16); },
    fontSize18: function () { setFontSize(18); },
    fontSize20: function () { setFontSize(20); },
    fontSize24: function () { setFontSize(24); },
    fontSize28: function () { setFontSize(28); },
    fontSize36: function () { setFontSize(36); },
    fontSize48: function () { setFontSize(48); },
    fontSize72: function () { setFontSize(72); },

    // Colors
    colorBlack: function () { setFontColor("#000000"); },
    colorRed: function () { setFontColor("#FF0000"); },
    colorBlue: function () { setFontColor("#0000FF"); },
    colorGreen: function () { setFontColor("#008000"); },
    colorOrange: function () { setFontColor("#FFA500"); },
    colorPurple: function () { setFontColor("#800080"); },

    // Highlight
    highlightYellow: function () {
      if (Office.context.host === Office.HostType.Word) {
        Word.run(function (ctx) {
          ctx.document.getSelection().font.highlightColor = "Yellow";
          return ctx.sync();
        }).then(function () { showToast("Highlighted."); })
          .catch(function (err) { showToast("Error: " + err.message); });
      } else if (Office.context.host === Office.HostType.Excel) {
        Excel.run(function (ctx) {
          ctx.workbook.getSelectedRange().format.fill.color = "#FFFF00";
          return ctx.sync();
        }).then(function () { showToast("Highlighted."); })
          .catch(function (err) { showToast("Error: " + err.message); });
      }
    },

    highlightNone: function () {
      if (Office.context.host === Office.HostType.Word) {
        Word.run(function (ctx) {
          ctx.document.getSelection().font.highlightColor = null;
          return ctx.sync();
        }).then(function () { showToast("Highlight removed."); })
          .catch(function (err) { showToast("Error: " + err.message); });
      } else if (Office.context.host === Office.HostType.Excel) {
        Excel.run(function (ctx) {
          ctx.workbook.getSelectedRange().format.fill.clear();
          return ctx.sync();
        }).then(function () { showToast("Highlight removed."); })
          .catch(function (err) { showToast("Error: " + err.message); });
      }
    },

    // Alignment
    alignLeft: function () { setAlignment("Left"); },
    alignCenter: function () { setAlignment("Center"); },
    alignRight: function () { setAlignment("Right"); },
    alignJustify: function () { setAlignment("Justified"); },

    // Insert
    insertTable: function () {
      if (Office.context.host === Office.HostType.Word) {
        Word.run(function (ctx) {
          ctx.document.getSelection().insertTable(3, 3, "After", [["", "", ""], ["", "", ""], ["", "", ""]]);
          return ctx.sync();
        }).then(function () { showToast("Table inserted."); })
          .catch(function (err) { showToast("Error: " + err.message); });
      } else if (Office.context.host === Office.HostType.Excel) {
        Excel.run(function (ctx) {
          var sheet = ctx.workbook.worksheets.getActiveWorksheet();
          var range = ctx.workbook.getSelectedRange();
          range.load("address");
          return ctx.sync().then(function () {
            sheet.tables.add(range.address, true).name = "QuickTable_" + Date.now();
            return ctx.sync();
          });
        }).then(function () { showToast("Table created."); })
          .catch(function (err) { showToast("Error: " + err.message); });
      } else {
        showToast("Not available for this app.");
      }
    },

    insertPageBreak: function () {
      if (Office.context.host === Office.HostType.Word) {
        Word.run(function (ctx) {
          ctx.document.getSelection().insertBreak("Page", "After");
          return ctx.sync();
        }).then(function () { showToast("Page break inserted."); })
          .catch(function (err) { showToast("Error: " + err.message); });
      } else {
        showToast("Not available for this app.");
      }
    },

    insertHorizontalLine: function () {
      if (Office.context.host === Office.HostType.Word) {
        Word.run(function (ctx) {
          ctx.document.getSelection().insertHtml('<hr style="border:1px solid #999;width:100%">', "After");
          return ctx.sync();
        }).then(function () { showToast("Line inserted."); })
          .catch(function (err) { showToast("Error: " + err.message); });
      } else {
        showToast("Not available for this app.");
      }
    },
  };

  // Helper: toggle Word/Excel font property
  function toggleFont(prop) {
    var host = Office.context.host;
    if (host === Office.HostType.Word) {
      Word.run(function (ctx) {
        var sel = ctx.document.getSelection();
        sel.font.load(prop);
        return ctx.sync().then(function () {
          sel.font[prop] = !sel.font[prop];
          return ctx.sync();
        });
      }).then(function () {
        showToast(prop.charAt(0).toUpperCase() + prop.slice(1) + " toggled.");
      }).catch(function (err) {
        showToast("Error: " + err.message);
      });
    } else if (host === Office.HostType.Excel) {
      Excel.run(function (ctx) {
        var range = ctx.workbook.getSelectedRange();
        range.format.font.load(prop);
        return ctx.sync().then(function () {
          range.format.font[prop] = !range.format.font[prop];
          return ctx.sync();
        });
      }).then(function () {
        showToast(prop.charAt(0).toUpperCase() + prop.slice(1) + " toggled.");
      }).catch(function (err) {
        showToast("Error: " + err.message);
      });
    } else {
      showToast("Not available for this app.");
    }
  }

  // Helper: set font size
  function setFontSize(size) {
    var host = Office.context.host;
    if (host === Office.HostType.Word) {
      Word.run(function (ctx) {
        ctx.document.getSelection().font.size = size;
        return ctx.sync();
      }).then(function () { showToast("Font size: " + size); })
        .catch(function (err) { showToast("Error: " + err.message); });
    } else if (host === Office.HostType.Excel) {
      Excel.run(function (ctx) {
        ctx.workbook.getSelectedRange().format.font.size = size;
        return ctx.sync();
      }).then(function () { showToast("Font size: " + size); })
        .catch(function (err) { showToast("Error: " + err.message); });
    } else {
      showToast("Not available for this app.");
    }
  }

  // Helper: set font color
  function setFontColor(color) {
    var host = Office.context.host;
    if (host === Office.HostType.Word) {
      Word.run(function (ctx) {
        ctx.document.getSelection().font.color = color;
        return ctx.sync();
      }).then(function () { showToast("Color applied."); })
        .catch(function (err) { showToast("Error: " + err.message); });
    } else if (host === Office.HostType.Excel) {
      Excel.run(function (ctx) {
        ctx.workbook.getSelectedRange().format.font.color = color;
        return ctx.sync();
      }).then(function () { showToast("Color applied."); })
        .catch(function (err) { showToast("Error: " + err.message); });
    } else {
      showToast("Not available for this app.");
    }
  }

  // Helper: set paragraph alignment
  function setAlignment(alignment) {
    var host = Office.context.host;
    if (host === Office.HostType.Word) {
      Word.run(function (ctx) {
        var paras = ctx.document.getSelection().paragraphs;
        paras.load("items");
        return ctx.sync().then(function () {
          paras.items.forEach(function (p) { p.alignment = alignment; });
          return ctx.sync();
        });
      }).then(function () { showToast("Alignment: " + alignment); })
        .catch(function (err) { showToast("Error: " + err.message); });
    } else if (host === Office.HostType.Excel) {
      Excel.run(function (ctx) {
        ctx.workbook.getSelectedRange().format.horizontalAlignment = alignment;
        return ctx.sync();
      }).then(function () { showToast("Alignment: " + alignment); })
        .catch(function (err) { showToast("Error: " + err.message); });
    } else {
      showToast("Not available for this app.");
    }
  }

  // Wire up buttons
  function setupButtons() {
    document.querySelectorAll(".cmd-btn[data-cmd]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var cmd = btn.getAttribute("data-cmd");
        if (commands[cmd]) {
          commands[cmd]();
        } else {
          showToast("Unknown command: " + cmd);
        }
      });
    });
  }

  // Initialize
  Office.onReady(function () {
    setupCollapsibles();
    setupButtons();
  });
})();
