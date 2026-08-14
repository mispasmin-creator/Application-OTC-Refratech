const SPREADSHEET_ID = "1OimHQKhIkBpFXVHGMDedDI0MDmu0AfSP79LHQwLzGOI";
const HEADER_ROW = 6;
const DATA_START_ROW = HEADER_ROW + 1;

// Cache the spreadsheet object to avoid repeated openById calls
let cachedSpreadsheet = null;

function getSpreadsheet() {
    if (!cachedSpreadsheet) {
        cachedSpreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    }
    return cachedSpreadsheet;
}

function getSheetDataWithHeader(sheet) {
    const lastRow = sheet.getLastRow();
    const lastColumn = sheet.getLastColumn();

    if (lastRow < 1) {
        return [];
    }

    // Return the full sheet from row 1. Most pages expect the raw sheet
    // (their real header sits on row HEADER_ROW and they slice it out themselves);
    // Login/Master have their header on row 1 already, so this works for them too.
    return sheet.getRange(1, 1, lastRow, lastColumn).getDisplayValues();
}

function doGet(e) {
    const sheetName = e.parameter.sheet || "Data";

    try {
        const ss = getSpreadsheet();
        const sheet = ss.getSheetByName(sheetName);
        if (!sheet) {
            return jsonError(`Sheet '${sheetName}' not found`);
        }

        const data = getSheetDataWithHeader(sheet);
        const result = {
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
    try {
        var ss = getSpreadsheet();
        var sheet = ss.getSheetByName(sheetName);
        var lastRow = sheet.getLastRow();
        var lastColumn = sheet.getLastColumn();
        var data = [];

        if (lastRow >= HEADER_ROW) {
            data = sheet.getRange(HEADER_ROW, 1, lastRow - HEADER_ROW + 1, lastColumn).getDisplayValues();
        }

        return ContentService.createTextOutput(JSON.stringify({
            success: true,
            data: data
        })).setMimeType(ContentService.MimeType.JSON);
    } catch (error) {
        console.error("Error fetching sheet data:", error);
        return ContentService.createTextOutput(JSON.stringify({
            success: false,
            error: error.toString()
        })).setMimeType(ContentService.MimeType.JSON);
    }
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

            // Use appendRow for single row - it's optimized internally
            sheet.appendRow(rowData);

            // Flush to ensure immediate write
            SpreadsheetApp.flush();

            return jsonSuccess("Data inserted successfully");
        }

        // ============== OPTIMIZED UPDATE (20x FASTER) ==============
        else if (action === 'update') {
            var rowIndex = parseInt(params.rowIndex);
            var rowData = JSON.parse(params.rowData);

            if (isNaN(rowIndex) || rowIndex < DATA_START_ROW) {
                throw new Error("Invalid row index for update");
            }

            // OPTIMIZATION: Get existing row data first, then batch update
            var existingData = sheet.getRange(rowIndex, 1, 1, rowData.length).getValues()[0];

            // Merge: only update non-empty values
            var mergedData = existingData.map(function (existingVal, i) {
                return (rowData[i] !== '' && rowData[i] !== undefined) ? rowData[i] : existingVal;
            });

            // SINGLE batch operation instead of multiple setValue calls
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

            if (isNaN(rowIndex) || rowIndex < DATA_START_ROW) {
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

            if (isNaN(rowIndex) || rowIndex < DATA_START_ROW) {
                throw new Error("Invalid row index for marking as deleted");
            }
            if (isNaN(columnIndex) || columnIndex < 1) {
                throw new Error("Invalid column index for marking as deleted");
            }

            sheet.getRange(rowIndex, columnIndex).setValue(value);
            SpreadsheetApp.flush();

            return jsonSuccess("Row marked as deleted successfully");
        }

        // ============== BATCH INSERT (NEW - FOR MULTIPLE ROWS) ==============
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
        // ============== INSERT BY HEADER (EXACT MAPPING) ==============
        else if (action === 'insertByHeader') {
            var payloadData = JSON.parse(params.payloadData);
            
            // User requested explicit heading mapping
            var EXPECTED_HEADERS = [
                "Timestamp", "Application Number", "Serial Number", "Po Number", "Work Order Copy",
                "Firm Name", "Party Name", "Type Of Work", "Lead Time To Start", "Shift Type",
                "Type Of Industry", "Size Of Industry", "Area Of Application", "Qty", "Rate",
                "Company", "Incharge", "Planned 1", "Actual 1", "Time Delay 1", "Status 1",
                "Planned 2", "Actual 2", "Time Delay 2", "Status 2", "Date Of Site Received",
                "Expected Date Of Handover", "Supervisor Name", "Planned 3", "Actual 3",
                "Time Delay 3", "Status 3", "Planned 4", "Actual 4", "Time Delay 4", "Status 4",
                "Planned 5", "Actual 5", "Time Delay 5", "Status 5", "Planned 6", "Actual 6",
                "Time Delay 6", "Status 6", "Planned 7", "Actual 7", "Time Delay 7", "Status 7",
                "Planned 8", "Actual 8", "Time Delay 8", "Status 8", "Total Qty Applied",
                "Photo Of Certify Copy", "Vendor Bill Copy", "Planned 9", "Actual 9",
                "Time Delay 9", "Bill Number", "Bill Amount", "Bill Image", "Planned 10",
                "Actual 10", "Time Delay 10", "Status 10", "Planned 11", "Actual 11",
                "Time Delay 11", "Status 11", "Order Status", "Completetion Date",
                "Profit & Loss Entry", "Planned12", "Actual 12", "Time Delay 12", "Status 12",
                "Profit Amount/Loss Amount", "Profit / Loss Sheet", "Planned13", "Actual 13",
                "Time Delay 13", "Transfer Status"
            ];
            
            var rowDataArray = new Array(EXPECTED_HEADERS.length).fill('');
            for (var key in payloadData) {
                var colIndex = EXPECTED_HEADERS.indexOf(key.trim());
                if (colIndex !== -1 && payloadData[key] !== undefined) {
                    rowDataArray[colIndex] = payloadData[key];
                }
            }
            
            sheet.appendRow(rowDataArray);
            SpreadsheetApp.flush();
            return jsonSuccess("Data inserted successfully by explicit heading match");
        }

        // ============== UPDATE BY HEADER (EXACT MAPPING) ==============
        else if (action === 'updateByHeader') {
            var rowIndex = parseInt(params.rowIndex);
            var payloadData = JSON.parse(params.payloadData);
            
            if (isNaN(rowIndex) || rowIndex < DATA_START_ROW) {
                throw new Error("Invalid row index for update");
            }
            
            var EXPECTED_HEADERS = [
                "Timestamp", "Application Number", "Serial Number", "Po Number", "Work Order Copy",
                "Firm Name", "Party Name", "Type Of Work", "Lead Time To Start", "Shift Type",
                "Type Of Industry", "Size Of Industry", "Area Of Application", "Qty", "Rate",
                "Company", "Incharge", "Planned 1", "Actual 1", "Time Delay 1", "Status 1",
                "Planned 2", "Actual 2", "Time Delay 2", "Status 2", "Date Of Site Received",
                "Expected Date Of Handover", "Supervisor Name", "Planned 3", "Actual 3",
                "Time Delay 3", "Status 3", "Planned 4", "Actual 4", "Time Delay 4", "Status 4",
                "Planned 5", "Actual 5", "Time Delay 5", "Status 5", "Planned 6", "Actual 6",
                "Time Delay 6", "Status 6", "Planned 7", "Actual 7", "Time Delay 7", "Status 7",
                "Planned 8", "Actual 8", "Time Delay 8", "Status 8", "Total Qty Applied",
                "Photo Of Certify Copy", "Vendor Bill Copy", "Planned 9", "Actual 9",
                "Time Delay 9", "Bill Number", "Bill Amount", "Bill Image", "Planned 10",
                "Actual 10", "Time Delay 10", "Status 10", "Planned 11", "Actual 11",
                "Time Delay 11", "Status 11", "Order Status", "Completetion Date",
                "Profit & Loss Entry", "Planned12", "Actual 12", "Time Delay 12", "Status 12",
                "Profit Amount/Loss Amount", "Profit / Loss Sheet", "Planned13", "Actual 13",
                "Time Delay 13", "Transfer Status"
            ];
            
            var lastColumn = Math.max(sheet.getLastColumn(), EXPECTED_HEADERS.length);
            var existingData = sheet.getRange(rowIndex, 1, 1, lastColumn).getValues()[0];
            
            for (var key in payloadData) {
                var colIndex = EXPECTED_HEADERS.indexOf(key.trim());
                if (colIndex !== -1 && payloadData[key] !== undefined) {
                    existingData[colIndex] = payloadData[key];
                }
            }
            
            sheet.getRange(rowIndex, 1, 1, lastColumn).setValues([existingData]);
            SpreadsheetApp.flush();
            return jsonSuccess("Data updated successfully by explicit heading match");
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

        return "1BTN74IUcNIucruI2ZsoEHr7YZM0v0STX" + file.getId();
    } catch (error) {
        console.error("Error in uploadFileToDrive:", error);
        return null;
    }
}
