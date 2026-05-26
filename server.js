const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const db = require('./db');
const fs = require('fs');
const path = require('path');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { createCanvas } = require('canvas');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// =========================================================================
// 💬 INITIALIZE WHATSAPP AUTOMATION (PROTECTED OUTSIDE ONEDRIVE LOCKS)
// =========================================================================
const client = new Client({
    authStrategy: new LocalAuth({ 
        // Moves cache profile path clear out of OneDrive folder memory targets
        dataPath: 'C:/v2_cafe_whatsapp_session' 
    }),
    puppeteer: { 
        headless: true, 
        args: ['--no-sandbox', '--disable-setuid-sandbox'] 
    }
});

// Prints the secure login QR code right inside your terminal workspace shell
client.on('qr', (qr) => {
    console.log('\n===============================================================');
    console.log('📷 SCAN THIS QR CODE WITH YOUR WHATSAPP WORK MOBILE TO LOG IN:');
    console.log('===============================================================\n');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('\n✅ SUCCESS: FREE WHATSAPP IMAGE DISPATCH ROUTER ACTIVE AND SYNCED!\n');
});

client.initialize();

// =========================================================================
// 🔏 ROUTE 1: CROSS-PORTAL ACCESS GATEWAY CONTROLLER
// =========================================================================
app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    if (username === 'owner' && password === 'owner123') {
        return res.json({ success: true, role: 'Owner', name: 'Ananya' });
    } else if (username === 'staff' && password === 'staff123') {
        return res.json({ success: true, role: 'Staff', name: 'V2 Counter' });
    }
    res.status(401).json({ success: false, error: 'Invalid login credentials!' });
});

// =========================================================================
// 🍔 ROUTE 2: FETCH MENU ITEMS & DYNAMIC CATEGORIES FOR UI PANELS
// =========================================================================
app.get('/api/menu', async (req, res) => {
    try {
        const [items] = await db.query('SELECT * FROM menu_items ORDER BY id DESC');
        const [categories] = await db.query('SELECT DISTINCT category_name FROM categories ORDER BY id DESC');
        res.json({ success: true, items, categories: categories.map(c => c.category_name) });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// =========================================================================
// 📈 ROUTE 3: TODAY'S METRIC ANALYTICS COMPILER CARD LAYER
// =========================================================================
app.get('/api/analytics/today', async (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    try {
        const [orderCount] = await db.query('SELECT COUNT(*) as count FROM orders WHERE DATE(order_date) = ?', [today]);
        
        const [starDish] = await db.query(
            `SELECT item_name, SUM(qty) as total_qty FROM order_items i 
             JOIN orders o ON o.order_id = i.order_id 
             WHERE DATE(o.order_date) = ? GROUP BY item_name ORDER BY total_qty DESC LIMIT 1`, [today]
        );

        const [topPerforming] = await db.query(
            `SELECT item_name, SUM(qty) as total_qty FROM order_items i 
             JOIN orders o ON o.order_id = i.order_id 
             GROUP BY item_name ORDER BY total_qty DESC LIMIT 5`
        );

        res.json({
            success: true,
            ordersToday: orderCount[0].count || 0,
            starDish: starDish[0] ? `${starDish[0].item_name.toUpperCase()} (${starDish[0].total_qty} QTY)` : 'NO SALES',
            topPerforming
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// =========================================================================
// 🏷️ ROUTE 4: INGEST & SAVE NEW ITEM CATEGORIES
// =========================================================================
app.post('/api/categories', async (req, res) => {
    const { category_name } = req.body;
    try {
        await db.query('INSERT INTO categories (category_name) VALUES (?)', [category_name]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// =========================================================================
// 📦 ROUTE 5: INGEST & INJECT NEW DISH PRODUCT RECORDS
// =========================================================================
app.post('/api/menu/add', async (req, res) => {
    const { item_name, category, price } = req.body;
    try {
        await db.query('INSERT INTO menu_items (item_name, category, price, status) VALUES (?, ?, ?, "Active")', [item_name, category, price]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// =========================================================================
// 💵 ROUTE 6: LIVE DATAGRID SPREADSHEET RATE ALTERATION UPDATER
// =========================================================================
app.put('/api/menu/update-price', async (req, res) => {
    const { id, price } = req.body;
    try {
        await db.query('UPDATE menu_items SET price = ? WHERE id = ?', [price, id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// =========================================================================
// 🛑 ROUTE 7: DISH TOGGLE DISABLE / ENABLE ENGINE
// =========================================================================
app.put('/api/menu/toggle-status', async (req, res) => {
    const { id, current_status } = req.body;
    const nextStatus = current_status === 'Active' ? 'Disabled' : 'Active';
    try {
        await db.query('UPDATE menu_items SET status = ? WHERE id = ?', [nextStatus, id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// =========================================================================
// 💳 ROUTE 8: TRANSACTION INGESTION & AUTOMATED THERMAL IMAGE DISPATCH
// =========================================================================
app.post('/api/orders', async (req, res) => {
    const { ref_id, payment_mode, discount, cart_data, customer_phone } = req.body;
    try {
        let subtotal = 0;
        cart_data.forEach(item => { subtotal += parseFloat(item.price) * parseInt(item.qty); });
        const discount_amt = (subtotal * parseFloat(discount)) / 100;
        const grand_total = Math.max(0, subtotal - discount_amt);

        // Commit transaction fields into your core table
        const [orderResult] = await db.query(
            'INSERT INTO orders (table_or_token, payment_mode, discount_amt, grand_total) VALUES (?, ?, ?, ?)',
            [ref_id, payment_mode, discount_amt, grand_total]
        );
        const order_id = orderResult.insertId;

        for (let item of cart_data) {
            await db.query(
                'INSERT INTO order_items (order_id, item_name, qty, price, total) VALUES (?, ?, ?, ?, ?)',
                [order_id, item.item, item.qty, item.price, item.price * item.qty]
            );
        }

        // 🎨 CORE CANVAS RENDERING LOGIC: SKETCH PERFECT 3-INCH IMAGE
        if (customer_phone && customer_phone.trim().length >= 10) {
            const width = 350;
            const rowHeight = 25;
            const height = 240 + (cart_data.length * rowHeight);
            
            const canvas = createCanvas(width, height);
            const ctx = canvas.getContext('2d');

            // Set up ticket context properties
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, width, height);

            ctx.fillStyle = '#000000';
            ctx.textAlign = 'center';
            ctx.font = 'bold 22px Courier New';
            ctx.fillText('☕ V2 CAFE', width / 2, 35);
            
            ctx.font = '12px Courier New';
            ctx.fillText('Stall Point of Sale Terminal', width / 2, 55);
            ctx.fillText(`Date: ${new Date().toLocaleDateString('en-GB')} | ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`, width / 2, 72);
            
            ctx.font = 'bold 14px Courier New';
            ctx.fillText('-----------------------------------', width / 2, 92);

            ctx.textAlign = 'left';
            ctx.font = '12px Courier New';
            ctx.fillText(`ORDER ID : #ORDER-${order_id}`, 20, 112);
            ctx.fillText(`REF CODE : ${ref_id.toUpperCase()}`, 20, 127);
            ctx.fillText(`PAYMENT  : ${payment_mode.toUpperCase()}`, 20, 142);
            
            ctx.textAlign = 'center';
            ctx.fillText('-----------------------------------', width / 2, 158);

            // Print item loops out cleanly onto the matrix space
            let currentY = 178;
            ctx.font = 'bold 12px Courier New';
            
            cart_data.forEach(item => {
                ctx.textAlign = 'left';
                ctx.fillText(`${item.item.toUpperCase()} (x${item.qty})`, 20, currentY);
                ctx.textAlign = 'right';
                ctx.fillText(`₹${(item.price * item.qty).toFixed(2)}`, width - 20, currentY);
                currentY += rowHeight;
            });

            ctx.textAlign = 'center';
            ctx.font = 'bold 14px Courier New';
            ctx.fillText('-----------------------------------', width / 2, currentY);
            currentY += 20;

            ctx.textAlign = 'right';
            ctx.font = '11px Courier New';
            ctx.fillText(`SUBTOTAL: ₹${subtotal.toFixed(2)}`, width - 20, currentY);
            currentY += 16;
            ctx.fillText(`DISCOUNT: ${discount}%`, width - 20, currentY);
            currentY += 26;

            ctx.font = 'bold 16px Courier New';
            ctx.fillText(`NET PAYABLE: ₹${grand_total.toFixed(2)}`, width - 20, currentY);
            currentY += 32;

            ctx.textAlign = 'center';
            ctx.font = 'bold 11px Courier New';
            ctx.fillText('*** THANK YOU! VISIT AGAIN ***', width / 2, currentY);

            // Export raw image canvas directly into a local workspace cache folder outside OneDrive boundaries
            const imgBuffer = canvas.toBuffer('image/png');
            const tempImagePath = path.join('C:/v2_cafe_whatsapp_session', `receipt-${order_id}.png`);
            fs.writeFileSync(tempImagePath, imgBuffer);

            // Pipe image data packet silently down to scanned consumer device routing lanes
            try {
                const cleanPhone = customer_phone.replace(/\D/g, '');
                const formattedPhone = cleanPhone.startsWith('91') ? cleanPhone : `91${cleanPhone}`;
                const chatId = `${formattedPhone}@c.us`;

                const media = MessageMedia.fromFilePath(tempImagePath);
                await client.sendMessage(chatId, media, { caption: 'Thank you for your purchase at V2 Cafe! Here is your digital receipt ticket. ☕❤️' });
                
                // Clear out file reference parameters inside memory block lanes
                fs.unlinkSync(tempImagePath);
            } catch (wsErr) {
                console.error("WhatsApp delivery background execution fail thread:", wsErr.message);
            }
        }

        res.json({ success: true, order_id });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// =========================================================================
// 📬 ROUTE 9: PREMIUM HTML LAYOUT SALES SUMMARY NODEMAILER ENGINE
// =========================================================================
app.get('/api/report/send', async (req, res) => {
    const { type, from_date, to_date } = req.query;
    let whereClause = "";
    let dateTitleStr = "";

    const today = new Date().toISOString().split('T')[0];
    const formattedToday = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-');

    if (type === 'custom' && from_date && to_date) {
        whereClause = `WHERE DATE(o.order_date) BETWEEN '${from_date}' AND '${to_date}'`;
        dateTitleStr = `${from_date} to ${to_date}`;
    } else {
        whereClause = `WHERE DATE(o.order_date) = '${today}'`;
        dateTitleStr = formattedToday;
    }

    try {
        const [rows] = await db.query(
            `SELECT o.order_id, o.order_date, o.table_or_token, o.payment_mode, i.item_name, i.qty, i.price 
             FROM orders o JOIN order_items i ON o.order_id = i.order_id 
             ${whereClause} ORDER BY o.order_id DESC`
        );

        const [totalRow] = await db.query(`SELECT SUM(grand_total) as final_sum FROM orders o ${whereClause.replace('o.', '')}`);
        const totalRevenue = totalRow[0].final_sum || 0;

        let htmlBody = `
        <div style='font-family: Arial, sans-serif; max-width: 400px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 15px; background: #fff;'>
            <h2 style='text-align: center; color: #524bfd; margin-bottom: 5px; font-weight: 800;'>☕ V2 CAFE</h2>
            <p style='text-align: center; color: #666; font-size: 13px; margin-top: 0; font-weight: bold;'>Sales Summary for ${dateTitleStr}</p>
            <hr style='border: 0; border-top: 1px dashed #ccc; margin-bottom: 10px;'>`;

        if (rows.length > 0) {
            let currentOrderId = null;
            rows.forEach(row => {
                const orderTime = new Date(row.order_date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
                if (currentOrderId !== row.order_id) {
                    if (currentOrderId !== null) htmlBody += `</div>`;
                    htmlBody += `
                    <div style='background: #212529; padding: 14px; border-radius: 12px; margin-top: 15px; border-left: 4px solid #524bfd; color: #fff; margin-bottom:10px;'>
                        <div style='font-weight: bold; font-size: 15px; margin-bottom: 3px;'>
                            #Order-${row.order_id} <span style='color: #94a3b8; font-weight: normal;'>${row.table_or_token}</span>
                        </div>
                        <div style='font-size: 11px; color: #94a3b8; margin-bottom: 8px; font-weight: bold;'>Mode: ${row.payment_mode} | ${orderTime}</div>`;
                    currentOrderId = row.order_id;
                }
                htmlBody += `<div style='font-size: 13px; margin-top: 4px; color: #e2e8f0;'>• ${row.item_name.toUpperCase()} (x${row.qty}) - ₹${parseFloat(row.price * row.qty).toFixed(2)}</div>`;
            });
            htmlBody += `</div>`;
            htmlBody += `
            <div style='margin-top: 25px; background: #111625; color: white; padding: 20px; border-radius: 15px; text-align: center;'>
                <small style='text-transform: uppercase; letter-spacing: 1.5px; opacity: 0.7; font-size: 10px; font-weight: 800; display: block; margin-bottom: 4px;'>Total Net Revenue</small>
                <h1 style='margin: 0; color: #10b981; font-size: 28px; font-weight: 900;'>₹${parseFloat(totalRevenue).toFixed(2)}</h1>
            </div>`;
        } else {
            htmlBody += `<p style='text-align: center; color: #94a3b8; padding: 20px; font-size: 13px;'>No sales recorded yet.</p>`;
        }
        htmlBody += `</div>`;

        let transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
        });

        await transporter.sendMail({
            from: `"V2 Cafe Terminal" <${process.env.EMAIL_USER}>`,
            to: process.env.EMAIL_USER,
            subject: `☕ V2 Cafe Sales Summary - ${dateTitleStr}`,
            html: htmlBody
        });

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Update the very last line in backend/server.js:
const PORT = 5000;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 BACKEND ENGINE RUNNING ON WIRELESS PORT ${PORT}`));