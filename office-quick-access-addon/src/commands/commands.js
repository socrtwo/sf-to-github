/*
 * Office Quick Access Add-in - Ribbon Command Functions
 *
 * These functions are called from ribbon dropdown menu items.
 * They replicate common Quick Access Toolbar commands using Office.js APIs.
 */

/* global Office, Word, Excel, PowerPoint */

Office.onReady(function () {
  // Office is ready
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getHostApp() {
  return Office.context.host;
}

function complete(event) {
  if (event && event.completed) {
    event.completed();
  }
}

function showNotification(message, event) {
  // In a real add-in you might use Office.context.mailbox.item.notificationMessages
  // or a toast library. For now we just log and complete.
  console.log("[QuickAccess]", message);
  complete(event);
}

// ---------------------------------------------------------------------------
// FILE commands
// ---------------------------------------------------------------------------

function cmdSave(event) {
  Office.context.document.save(
    Office.AsyncResultStatus || {},
    function (result) {
      if (result.status === Office.AsyncResultStatus.Failed) {
        showNotification("Save failed: " + result.error.message, event);
      } else {
        showNotification("Document saved.", event);
      }
    }
  );
}

function cmdClose(event) {
  // Office.js has no close API; inform the user.
  showNotification(
    "Close is not available from add-ins. Use File > Close instead.",
    event
  );
}

// ---------------------------------------------------------------------------
// EDIT / CLIPBOARD commands
// ---------------------------------------------------------------------------

function cmdUndo(event) {
  showNotification(
    "Undo is not available from add-ins. Use Ctrl+Z / Cmd+Z.",
    event
  );
}

function cmdRedo(event) {
  showNotification(
    "Redo is not available from add-ins. Use Ctrl+Y / Cmd+Shift+Z.",
    event
  );
}

function cmdCut(event) {
  document.execCommand("cut");
  showNotification("Cut executed (taskpane selection only).", event);
}

function cmdCopy(event) {
  document.execCommand("copy");
  showNotification("Copy executed (taskpane selection only).", event);
}

function cmdPaste(event) {
  showNotification(
    "Paste is not available from add-ins. Use Ctrl+V / Cmd+V.",
    event
  );
}

function cmdSelectAll(event) {
  var host = getHostApp();

  if (host === Office.HostType.Word) {
    Word.run(function (ctx) {
      var body = ctx.document.body;
      var range = body.getRange();
      range.select();
      return ctx.sync();
    })
      .then(function () {
        complete(event);
      })
      .catch(function (err) {
        showNotification("Select All failed: " + err.message, event);
      });
  } else {
    showNotification("Select All: use Ctrl+A / Cmd+A.", event);
  }
}

// ---------------------------------------------------------------------------
// FORMAT – Text
// ---------------------------------------------------------------------------

function applyWordFontProp(prop, value, event) {
  Word.run(function (ctx) {
    var sel = ctx.document.getSelection();
    sel.font[prop] = value;
    return ctx.sync();
  })
    .then(function () {
      complete(event);
    })
    .catch(function (err) {
      showNotification("Format failed: " + err.message, event);
    });
}

function applyExcelFontProp(prop, value, event) {
  Excel.run(function (ctx) {
    var range = ctx.workbook.getSelectedRange();
    range.format.font[prop] = value;
    return ctx.sync();
  })
    .then(function () {
      complete(event);
    })
    .catch(function (err) {
      showNotification("Format failed: " + err.message, event);
    });
}

function toggleFontProp(prop, event) {
  var host = getHostApp();

  if (host === Office.HostType.Word) {
    Word.run(function (ctx) {
      var sel = ctx.document.getSelection();
      sel.font.load(prop);
      return ctx.sync().then(function () {
        sel.font[prop] = !sel.font[prop];
        return ctx.sync();
      });
    })
      .then(function () {
        complete(event);
      })
      .catch(function (err) {
        showNotification("Format toggle failed: " + err.message, event);
      });
  } else if (host === Office.HostType.Excel) {
    Excel.run(function (ctx) {
      var range = ctx.workbook.getSelectedRange();
      range.format.font.load(prop);
      return ctx.sync().then(function () {
        range.format.font[prop] = !range.format.font[prop];
        return ctx.sync();
      });
    })
      .then(function () {
        complete(event);
      })
      .catch(function (err) {
        showNotification("Format toggle failed: " + err.message, event);
      });
  } else {
    showNotification("Formatting not supported for this host app.", event);
  }
}

function cmdBold(event) {
  toggleFontProp("bold", event);
}

function cmdItalic(event) {
  toggleFontProp("italic", event);
}

function cmdUnderline(event) {
  var host = getHostApp();
  if (host === Office.HostType.Word) {
    Word.run(function (ctx) {
      var sel = ctx.document.getSelection();
      sel.font.load("underline");
      return ctx.sync().then(function () {
        sel.font.underline =
          sel.font.underline === "None" ? "Single" : "None";
        return ctx.sync();
      });
    })
      .then(function () {
        complete(event);
      })
      .catch(function (err) {
        showNotification("Underline failed: " + err.message, event);
      });
  } else if (host === Office.HostType.Excel) {
    toggleFontProp("underline", event);
  } else {
    showNotification("Underline not available for this host.", event);
  }
}

function cmdStrikethrough(event) {
  toggleFontProp("strikethrough", event);
}

function cmdSuperscript(event) {
  var host = getHostApp();
  if (host === Office.HostType.Word) {
    Word.run(function (ctx) {
      var sel = ctx.document.getSelection();
      sel.font.load("superscript");
      return ctx.sync().then(function () {
        sel.font.superscript = !sel.font.superscript;
        return ctx.sync();
      });
    })
      .then(function () {
        complete(event);
      })
      .catch(function (err) {
        showNotification("Superscript failed: " + err.message, event);
      });
  } else {
    showNotification("Superscript not available for this host.", event);
  }
}

function cmdSubscript(event) {
  var host = getHostApp();
  if (host === Office.HostType.Word) {
    Word.run(function (ctx) {
      var sel = ctx.document.getSelection();
      sel.font.load("subscript");
      return ctx.sync().then(function () {
        sel.font.subscript = !sel.font.subscript;
        return ctx.sync();
      });
    })
      .then(function () {
        complete(event);
      })
      .catch(function (err) {
        showNotification("Subscript failed: " + err.message, event);
      });
  } else {
    showNotification("Subscript not available for this host.", event);
  }
}

// ---------------------------------------------------------------------------
// FORMAT – Font size presets
// ---------------------------------------------------------------------------

function setFontSize(size, event) {
  var host = getHostApp();
  if (host === Office.HostType.Word) {
    applyWordFontProp("size", size, event);
  } else if (host === Office.HostType.Excel) {
    applyExcelFontProp("size", size, event);
  } else {
    showNotification("Font size not available for this host.", event);
  }
}

function cmdFontSize8(event) { setFontSize(8, event); }
function cmdFontSize10(event) { setFontSize(10, event); }
function cmdFontSize11(event) { setFontSize(11, event); }
function cmdFontSize12(event) { setFontSize(12, event); }
function cmdFontSize14(event) { setFontSize(14, event); }
function cmdFontSize16(event) { setFontSize(16, event); }
function cmdFontSize18(event) { setFontSize(18, event); }
function cmdFontSize20(event) { setFontSize(20, event); }
function cmdFontSize24(event) { setFontSize(24, event); }
function cmdFontSize28(event) { setFontSize(28, event); }
function cmdFontSize36(event) { setFontSize(36, event); }
function cmdFontSize48(event) { setFontSize(48, event); }
function cmdFontSize72(event) { setFontSize(72, event); }

// ---------------------------------------------------------------------------
// FORMAT – Font color presets
// ---------------------------------------------------------------------------

function setFontColor(color, event) {
  var host = getHostApp();
  if (host === Office.HostType.Word) {
    applyWordFontProp("color", color, event);
  } else if (host === Office.HostType.Excel) {
    applyExcelFontProp("color", color, event);
  } else {
    showNotification("Font color not available for this host.", event);
  }
}

function cmdColorBlack(event) { setFontColor("#000000", event); }
function cmdColorRed(event) { setFontColor("#FF0000", event); }
function cmdColorBlue(event) { setFontColor("#0000FF", event); }
function cmdColorGreen(event) { setFontColor("#008000", event); }
function cmdColorOrange(event) { setFontColor("#FFA500", event); }
function cmdColorPurple(event) { setFontColor("#800080", event); }

// ---------------------------------------------------------------------------
// FORMAT – Highlight (Word only)
// ---------------------------------------------------------------------------

function cmdHighlightYellow(event) {
  var host = getHostApp();
  if (host === Office.HostType.Word) {
    Word.run(function (ctx) {
      var sel = ctx.document.getSelection();
      sel.font.highlightColor = "Yellow";
      return ctx.sync();
    })
      .then(function () {
        complete(event);
      })
      .catch(function (err) {
        showNotification("Highlight failed: " + err.message, event);
      });
  } else if (host === Office.HostType.Excel) {
    Excel.run(function (ctx) {
      var range = ctx.workbook.getSelectedRange();
      range.format.fill.color = "#FFFF00";
      return ctx.sync();
    })
      .then(function () {
        complete(event);
      })
      .catch(function (err) {
        showNotification("Highlight failed: " + err.message, event);
      });
  } else {
    showNotification("Highlight not available for this host.", event);
  }
}

function cmdHighlightNone(event) {
  var host = getHostApp();
  if (host === Office.HostType.Word) {
    Word.run(function (ctx) {
      var sel = ctx.document.getSelection();
      sel.font.highlightColor = null;
      return ctx.sync();
    })
      .then(function () {
        complete(event);
      })
      .catch(function (err) {
        showNotification("Remove highlight failed: " + err.message, event);
      });
  } else if (host === Office.HostType.Excel) {
    Excel.run(function (ctx) {
      var range = ctx.workbook.getSelectedRange();
      range.format.fill.clear();
      return ctx.sync();
    })
      .then(function () {
        complete(event);
      })
      .catch(function (err) {
        showNotification("Remove highlight failed: " + err.message, event);
      });
  } else {
    showNotification("Highlight not available for this host.", event);
  }
}

// ---------------------------------------------------------------------------
// FORMAT – Paragraph alignment (Word only)
// ---------------------------------------------------------------------------

function setAlignment(alignment, event) {
  var host = getHostApp();
  if (host === Office.HostType.Word) {
    Word.run(function (ctx) {
      var sel = ctx.document.getSelection();
      var paragraphs = sel.paragraphs;
      paragraphs.load("items");
      return ctx.sync().then(function () {
        paragraphs.items.forEach(function (p) {
          p.alignment = alignment;
        });
        return ctx.sync();
      });
    })
      .then(function () {
        complete(event);
      })
      .catch(function (err) {
        showNotification("Alignment failed: " + err.message, event);
      });
  } else if (host === Office.HostType.Excel) {
    Excel.run(function (ctx) {
      var range = ctx.workbook.getSelectedRange();
      range.format.horizontalAlignment = alignment;
      return ctx.sync();
    })
      .then(function () {
        complete(event);
      })
      .catch(function (err) {
        showNotification("Alignment failed: " + err.message, event);
      });
  } else {
    showNotification("Alignment not available for this host.", event);
  }
}

function cmdAlignLeft(event) { setAlignment("Left", event); }
function cmdAlignCenter(event) { setAlignment("Center", event); }
function cmdAlignRight(event) { setAlignment("Right", event); }
function cmdAlignJustify(event) { setAlignment("Justified", event); }

// ---------------------------------------------------------------------------
// INSERT commands
// ---------------------------------------------------------------------------

function cmdInsertTable(event) {
  var host = getHostApp();
  if (host === Office.HostType.Word) {
    Word.run(function (ctx) {
      var sel = ctx.document.getSelection();
      sel.insertTable(3, 3, "After", [
        ["", "", ""],
        ["", "", ""],
        ["", "", ""],
      ]);
      return ctx.sync();
    })
      .then(function () {
        complete(event);
      })
      .catch(function (err) {
        showNotification("Insert table failed: " + err.message, event);
      });
  } else if (host === Office.HostType.Excel) {
    Excel.run(function (ctx) {
      var sheet = ctx.workbook.worksheets.getActiveWorksheet();
      var range = ctx.workbook.getSelectedRange();
      range.load("address");
      return ctx.sync().then(function () {
        var table = sheet.tables.add(range.address, true);
        table.name = "QuickTable_" + Date.now();
        return ctx.sync();
      });
    })
      .then(function () {
        complete(event);
      })
      .catch(function (err) {
        showNotification("Insert table failed: " + err.message, event);
      });
  } else {
    showNotification("Insert table not available for this host.", event);
  }
}

function cmdInsertPageBreak(event) {
  var host = getHostApp();
  if (host === Office.HostType.Word) {
    Word.run(function (ctx) {
      var sel = ctx.document.getSelection();
      sel.insertBreak("Page", "After");
      return ctx.sync();
    })
      .then(function () {
        complete(event);
      })
      .catch(function (err) {
        showNotification("Insert page break failed: " + err.message, event);
      });
  } else {
    showNotification("Page break not available for this host.", event);
  }
}

function cmdInsertHorizontalLine(event) {
  var host = getHostApp();
  if (host === Office.HostType.Word) {
    Word.run(function (ctx) {
      var sel = ctx.document.getSelection();
      sel.insertHtml(
        '<hr style="border:1px solid #999; width:100%;">',
        "After"
      );
      return ctx.sync();
    })
      .then(function () {
        complete(event);
      })
      .catch(function (err) {
        showNotification(
          "Insert horizontal line failed: " + err.message,
          event
        );
      });
  } else {
    showNotification("Horizontal line not available for this host.", event);
  }
}

function cmdInsertComment(event) {
  showNotification("Insert Comment: use Review tab or Ctrl+Alt+M.", event);
}

// ---------------------------------------------------------------------------
// REVIEW commands
// ---------------------------------------------------------------------------

function cmdSpellCheck(event) {
  showNotification("Spell Check: use Review > Spelling or F7.", event);
}

function cmdTrackChanges(event) {
  showNotification("Track Changes: use Review > Track Changes.", event);
}

// ---------------------------------------------------------------------------
// VIEW commands
// ---------------------------------------------------------------------------

function cmdZoomIn(event) {
  showNotification("Zoom In: use Ctrl+= or View > Zoom.", event);
}

function cmdZoomOut(event) {
  showNotification("Zoom Out: use Ctrl+- or View > Zoom.", event);
}

// ---------------------------------------------------------------------------
// PRINT
// ---------------------------------------------------------------------------

function cmdPrint(event) {
  showNotification("Print: use Ctrl+P / Cmd+P.", event);
}

// ---------------------------------------------------------------------------
// OPEN TASK PANE (fallback for commands that need richer UI)
// ---------------------------------------------------------------------------

function cmdOpenTaskpane(event) {
  Office.addin.showAsTaskpane();
  complete(event);
}

// ---------------------------------------------------------------------------
// Register all functions for ribbon commands
// ---------------------------------------------------------------------------

Office.actions = Office.actions || {};
Office.actions.associate("cmdSave", cmdSave);
Office.actions.associate("cmdClose", cmdClose);
Office.actions.associate("cmdUndo", cmdUndo);
Office.actions.associate("cmdRedo", cmdRedo);
Office.actions.associate("cmdCut", cmdCut);
Office.actions.associate("cmdCopy", cmdCopy);
Office.actions.associate("cmdPaste", cmdPaste);
Office.actions.associate("cmdSelectAll", cmdSelectAll);
Office.actions.associate("cmdBold", cmdBold);
Office.actions.associate("cmdItalic", cmdItalic);
Office.actions.associate("cmdUnderline", cmdUnderline);
Office.actions.associate("cmdStrikethrough", cmdStrikethrough);
Office.actions.associate("cmdSuperscript", cmdSuperscript);
Office.actions.associate("cmdSubscript", cmdSubscript);
Office.actions.associate("cmdFontSize8", cmdFontSize8);
Office.actions.associate("cmdFontSize10", cmdFontSize10);
Office.actions.associate("cmdFontSize11", cmdFontSize11);
Office.actions.associate("cmdFontSize12", cmdFontSize12);
Office.actions.associate("cmdFontSize14", cmdFontSize14);
Office.actions.associate("cmdFontSize16", cmdFontSize16);
Office.actions.associate("cmdFontSize18", cmdFontSize18);
Office.actions.associate("cmdFontSize20", cmdFontSize20);
Office.actions.associate("cmdFontSize24", cmdFontSize24);
Office.actions.associate("cmdFontSize28", cmdFontSize28);
Office.actions.associate("cmdFontSize36", cmdFontSize36);
Office.actions.associate("cmdFontSize48", cmdFontSize48);
Office.actions.associate("cmdFontSize72", cmdFontSize72);
Office.actions.associate("cmdColorBlack", cmdColorBlack);
Office.actions.associate("cmdColorRed", cmdColorRed);
Office.actions.associate("cmdColorBlue", cmdColorBlue);
Office.actions.associate("cmdColorGreen", cmdColorGreen);
Office.actions.associate("cmdColorOrange", cmdColorOrange);
Office.actions.associate("cmdColorPurple", cmdColorPurple);
Office.actions.associate("cmdHighlightYellow", cmdHighlightYellow);
Office.actions.associate("cmdHighlightNone", cmdHighlightNone);
Office.actions.associate("cmdAlignLeft", cmdAlignLeft);
Office.actions.associate("cmdAlignCenter", cmdAlignCenter);
Office.actions.associate("cmdAlignRight", cmdAlignRight);
Office.actions.associate("cmdAlignJustify", cmdAlignJustify);
Office.actions.associate("cmdInsertTable", cmdInsertTable);
Office.actions.associate("cmdInsertPageBreak", cmdInsertPageBreak);
Office.actions.associate("cmdInsertHorizontalLine", cmdInsertHorizontalLine);
Office.actions.associate("cmdInsertComment", cmdInsertComment);
Office.actions.associate("cmdSpellCheck", cmdSpellCheck);
Office.actions.associate("cmdTrackChanges", cmdTrackChanges);
Office.actions.associate("cmdZoomIn", cmdZoomIn);
Office.actions.associate("cmdZoomOut", cmdZoomOut);
Office.actions.associate("cmdPrint", cmdPrint);
Office.actions.associate("cmdOpenTaskpane", cmdOpenTaskpane);
