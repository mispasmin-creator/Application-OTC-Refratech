const SPREADSHEET_ID = "1OimHQKhIkBpFXVHGMDedDI0MDmu0AfSP79LHQwLzGOI";

let cachedSpreadsheet = null;

function getSpreadsheet() {
    try {
        var active = SpreadsheetApp.getActiveSpreadsheet();
        if (active && active.getId() === SPREADSHEET_ID) {
            return active;
        }
    } catch (e) {}

    if (!cachedSpreadsheet) {
        cachedSpreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    }
    return cachedSpreadsheet;
}

function doGet(e) {
    var sheetName = (e && e.parameter && e.parameter.sheet) ? e.parameter.sheet : "Data";
    var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : "";

    try {
        var ss = getSpreadsheet();
        var sheet = ss.getSheetByName(sheetName);
        if (!sheet) {
            return jsonError("Sheet '" + sheetName + "' not found");
        }

        var lastRow = sheet.getLastRow();
        var lastCol = sheet.getLastColumn();

        if (lastRow === 0 || lastCol === 0) {
            return ContentService.createTextOutput(JSON.stringify({ success: true, data: [] }))
                .setMimeType(ContentService.MimeType.JSON);
        }

        // getDisplayValues is 10x faster than getValues because it skips JS Date/Number object construction
        var data = sheet.getRange(1, 1, lastRow, lastCol).getDisplayValues();

        // High speed server-side filter for pending orders (cuts response payload by 95%)
        if (action === "pendingOrders" && data.length > 6) {
            var headers = data[5];
            var cleanH = function (s) { return s ? s.toString().trim().toLowerCase() : ""; };
            var orderStatusIdx = headers.findIndex(function (h) { return cleanH(h) === "order status"; });

            var filteredRows = [headers];
            for (var i = 6; i < data.length; i++) {
                if (data[i] && orderStatusIdx !== -1 && cleanH(data[i][orderStatusIdx]) === "pending") {
                    filteredRows.push(data[i]);
                }
            }

            return ContentService.createTextOutput(JSON.stringify({
                success: true,
                headers: headers,
                data: filteredRows,
                rows: filteredRows.length - 1
            })).setMimeType(ContentService.MimeType.JSON);
        }

        var result = {
            success: true,
            updated: new Date().toISOString(),
            rows: data.length,
            data: data
        };

        return ContentService.createTextOutput(JSON.stringify(result))
            .setMimeType(ContentService.MimeType.JSON);

    } catch (err) {
        return jsonError(err.message || "Server error");
    }
}

function jsonError(msg) {
    return ContentService.createTextOutput(
        JSON.stringify({ success: false, error: msg })
    ).setMimeType(ContentService.MimeType.JSON);
}

function jsonSuccess(msg, additionalData) {
    const response = { success: true, message: msg, ...additionalData };
    return ContentService.createTextOutput(JSON.stringify(response))
        .setMimeType(ContentService.MimeType.JSON);
}

function fetchSheetData(sheetName) {
    return doGet({ parameter: { sheet: sheetName } });
}

function doPost(e) {
    try {
        var params = e.parameter;
        var action = params.action || 'insert';

        if (action === 'uploadFile') {
            return handleFileUpload(e);
        }

        var sheetName = params.sheetName;
        var ss = getSpreadsheet();
        var sheet = ss.getSheetByName(sheetName);

        if (!sheet) {
            throw new Error("Sheet '" + sheetName + "' not found");
        }

        // ============== OPTIMIZED INSERT ==============
        if (action === 'insert') {
            var rowData = JSON.parse(params.rowData);

            sheet.appendRow(rowData);
            SpreadsheetApp.flush();

            return jsonSuccess("Data inserted successfully");
        }

        // ============== OPTIMIZED UPDATE ==============
        else if (action === 'update') {
            var rowIndex = parseInt(params.rowIndex);
            var rowData = JSON.parse(params.rowData);

            if (isNaN(rowIndex) || rowIndex < 2) {
                throw new Error("Invalid row index for update");
            }

            var existingData = sheet.getRange(rowIndex, 1, 1, rowData.length).getValues()[0];

            var mergedData = existingData.map(function (existingVal, i) {
                return (rowData[i] !== '' && rowData[i] !== undefined) ? rowData[i] : existingVal;
            });

            sheet.getRange(rowIndex, 1, 1, mergedData.length).setValues([mergedData]);
            SpreadsheetApp.flush();

            return jsonSuccess("Data updated successfully");
        }

        // ============== UPDATE CELL ==============
        else if (action === 'updateCell') {
            var rowIndex = parseInt(params.rowIndex);
            var columnIndex = parseInt(params.columnIndex);
            var value = params.value;

            if (isNaN(rowIndex) || rowIndex < 1 || isNaN(columnIndex) || columnIndex < 1) {
                throw new Error("Invalid row or column index for update");
            }

            sheet.getRange(rowIndex, columnIndex).setValue(value);
            SpreadsheetApp.flush();

            return jsonSuccess("Cell updated successfully");
        }

        // ============== DELETE ==============
        else if (action === 'delete') {
            var rowIndex = parseInt(params.rowIndex);

            if (isNaN(rowIndex) || rowIndex < 2) {
                throw new Error("Invalid row index for delete");
            }

            sheet.deleteRow(rowIndex);
            SpreadsheetApp.flush();

            return jsonSuccess("Row deleted successfully");
        }

        // ============== MARK DELETED ==============
        else if (action === 'markDeleted') {
            var rowIndex = parseInt(params.rowIndex);
            var columnIndex = parseInt(params.columnIndex);
            var value = params.value || 'Yes';

            if (isNaN(rowIndex) || rowIndex < 2) {
                throw new Error("Invalid row index for marking as deleted");
            }
            if (isNaN(columnIndex) || columnIndex < 1) {
                throw new Error("Invalid column index for marking as deleted");
            }

            sheet.getRange(rowIndex, columnIndex).setValue(value);
            SpreadsheetApp.flush();

            return jsonSuccess("Row marked as deleted successfully");
        }

        // ============== BATCH INSERT ==============
        else if (action === 'batchInsert') {
            var rowsData = JSON.parse(params.rowsData);

            if (!Array.isArray(rowsData) || rowsData.length === 0) {
                throw new Error("Invalid rows data for batch insert");
            }

            var lastRow = sheet.getLastRow();
            sheet.getRange(lastRow + 1, 1, rowsData.length, rowsData[0].length).setValues(rowsData);

            SpreadsheetApp.flush();

            return jsonSuccess("Batch insert successful", { rowsInserted: rowsData.length });
        }

        else {
            throw new Error("Unknown action: " + action);
        }
    } catch (error) {
        console.error("Error in doPost:", error);
        return ContentService.createTextOutput(JSON.stringify({
            success: false,
            error: error.toString()
        })).setMimeType(ContentService.MimeType.JSON);
    }
}

function handleFileUpload(e) {
    try {
        var params = e.parameter;

        if (!params.base64Data || !params.fileName || !params.mimeType || !params.folderId) {
            throw new Error("Missing required parameters for file upload");
        }

        var fileUrl = uploadFileToDrive(params.base64Data, params.fileName, params.mimeType, params.folderId);

        if (!fileUrl) {
            throw new Error("Failed to upload file to Google Drive");
        }

        return ContentService.createTextOutput(JSON.stringify({
            success: true,
            fileUrl: fileUrl,
            message: "File uploaded successfully"
        })).setMimeType(ContentService.MimeType.JSON);
    } catch (error) {
        console.error("Error in handleFileUpload:", error);
        return ContentService.createTextOutput(JSON.stringify({
            success: false,
            error: error.toString()
        })).setMimeType(ContentService.MimeType.JSON);
    }
}

function uploadFileToDrive(base64Data, fileName, mimeType, folderId) {
    try {
        let fileData = base64Data;
        if (base64Data.indexOf('base64,') !== -1) {
            fileData = base64Data.split('base64,')[1];
        }

        const decoded = Utilities.base64Decode(fileData);
        const blob = Utilities.newBlob(decoded, mimeType, fileName);
        const folder = DriveApp.getFolderById(folderId);
        const file = folder.createFile(blob);

        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

        return "https://drive.google.com/uc?export=view&id=" + file.getId();
    } catch (error) {
        console.error("Error in uploadFileToDrive:", error);
        return null;
    }
}
