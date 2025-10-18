const express = require('express');
const cors = require('cors');
const fs = require('fs');
const XLSX = require('xlsx');
const app = express();

app.use(cors()); // Enable CORS for client requests
app.use(express.json()); // Parse JSON bodies
app.use(express.static('.')); // Serve static files (HTML, CSS, Excel)

// API to update Order List.xlsx
app.post('/update-order-list', (req, res) => {
  try {
    const { mobileNumber, items } = req.body; // Get mobile number and cart items
    const filePath = 'Order List.xlsx';

    // Load existing Order List.xlsx
    let workbook;
    let orderData = [];
    if (fs.existsSync(filePath)) {
      workbook = XLSX.readFile(filePath, { cellText: false, cellDates: true });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      orderData = XLSX.utils.sheet_to_json(sheet, { raw: false });
    } else {
      return res.status(404).json({ error: 'Order List.xlsx not found' });
    }

    // Find customer
    const customer = orderData.find(row => String(row['Mobile Number']).trim() === String(mobileNumber).trim());
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Update order list and price
    const currentItems = customer['Order List'] ? customer['Order List'].split(',').filter(item => item) : [];
    const newItems = items.map(item => item.name);
    customer['Order List'] = [...currentItems, ...newItems].filter(item => item).join(',');
    customer['Price'] = (customer['Price'] || 0) + items.reduce((sum, item) => sum + item.price, 0);

    // Save updated file
    const worksheet = XLSX.utils.json_to_sheet(orderData);
    workbook.Sheets[workbook.SheetNames[0]] = worksheet;
    XLSX.writeFile(workbook, filePath);

    res.json({ message: 'Order List.xlsx updated successfully' });
  } catch (error) {
    console.error('Error updating Order List.xlsx:', error);
    res.status(500).json({ error: 'Failed to update order' });
  }
});

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});