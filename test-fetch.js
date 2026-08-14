
const url = process.env.VITE_APPSCRIPT_URL;
fetch(`${url}?sheet=FMS`)
  .then(res => res.json())
  .then(data => {
    console.log("Total rows:", data.data.length);
    for(let i=0; i<Math.min(10, data.data.length); i++) {
      console.log(`Row ${i}:`, data.data[i]);
    }
  })
  .catch(err => console.error(err));
