const url = "https://script.google.com/macros/s/AKfycbzQejaZmEwX_khdrZShwS94Q1f2CWAjbrcxb-hITPwewD70-W35vTbDu35DVU_--jWxuQ/exec?sheet=FMS";

fetch(url)
  .then(res => res.json())
  .then(async data => {
    if (!data.success) {
      console.log("Failed", data);
      return;
    }
    const sheetData = data.data;
    const headers = sheetData.length > 4 ? sheetData[4] : sheetData[0];
    
    // find index of Planned12, Actual 12, Planned13
    const p12Idx = headers.findIndex(h => h && h.toString().trim() === 'Planned12');
    const a12Idx = headers.findIndex(h => h && h.toString().trim() === 'Actual 12');
    const p13Idx = headers.findIndex(h => h && h.toString().trim() === 'Planned13');
    
    console.log("Headers found:");
    console.log("Planned12:", p12Idx !== -1 ? headers[p12Idx] : 'MISSING');
    console.log("Actual 12:", a12Idx !== -1 ? headers[a12Idx] : 'MISSING');
    console.log("Planned13:", p13Idx !== -1 ? headers[p13Idx] : 'MISSING');
    
    if (p12Idx === -1 || a12Idx === -1 || p13Idx === -1) {
       console.log("A column is missing!");
       return;
    }

    // Find the stuck row
    const stuckRows = [];
    for (let i = 5; i < sheetData.length; i++) {
        const row = sheetData[i];
        const hasA12 = row[a12Idx] && row[a12Idx].toString().trim() !== '';
        const noP13 = !row[p13Idx] || row[p13Idx].toString().trim() === '';
        if (hasA12 && noP13) {
            stuckRows.push({ rowIndex: i + 1, rowData: row });
        }
    }
    
    console.log(`Found ${stuckRows.length} stuck rows.`);
    
    // Fix them
    for (const stuck of stuckRows) {
        console.log(`Fixing row ${stuck.rowIndex}... setting Planned13`);
        
        const pad = (n) => n.toString().padStart(2, '0');
        const d = new Date();
        const formattedDate = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
        
        const params = new URLSearchParams();
        params.append('sheetName', 'FMS');
        params.append('action', 'updateCell');
        params.append('rowIndex', stuck.rowIndex);
        params.append('columnIndex', p13Idx + 1); // 1-based
        params.append('value', formattedDate);
        
        const res = await fetch("https://script.google.com/macros/s/AKfycbzQejaZmEwX_khdrZShwS94Q1f2CWAjbrcxb-hITPwewD70-W35vTbDu35DVU_--jWxuQ/exec", {
            method: 'POST',
            body: params
        });
        const r = await res.json();
        console.log(`Fix response for row ${stuck.rowIndex}:`, r);
    }
  })
  .catch(console.error);
