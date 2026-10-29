const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');
const csv = require('csv-parser');

// Link export CSV trực tiếp từ Google Sheet của anh
const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/1G2OEe6Un6xms2vGLjhOqeQn8wTBx5AGSPU0nrcUwn6s/export?format=csv&gid=0';

function formatVND(amount) {
    if (!amount) return '0đ';
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

async function fetchProductsFromSheet() {
    const response = await fetch(SHEET_CSV_URL);
    if (!response.ok) {
        throw new Error(`Không thể truy cập Google Sheet. Mã lỗi HTTP: ${response.status}`);
    }
    
    const csvText = await response.text();

    return new Promise((resolve, reject) => {
        const products = [];
        Readable.from(csvText)
            .pipe(csv())
            .on('data', (row) => {
                const cleanRow = {};
                for (let key in row) {
                    const cleanKey = key.replace(/^\uFEFF/, '').trim();
                    cleanRow[cleanKey] = row[key];
                }

                if (cleanRow.id && cleanRow.id.trim() !== '') {
                    products.push({
                        id: cleanRow.id.trim(),
                        name: cleanRow.name ? cleanRow.name.trim() : '',
                        category: cleanRow.category ? cleanRow.category.trim() : '',
                        price: Number(cleanRow.price) || 0,
                        originalPrice: Number(cleanRow.originalPrice) || 0,
                        unit: cleanRow.unit ? cleanRow.unit.trim() : '',
                        heavy: cleanRow.heavy === 'TRUE' || cleanRow.heavy === 'true' || cleanRow.heavy === '1',
                        image: cleanRow.image ? cleanRow.image.trim() : '',
                        description: cleanRow.description ? cleanRow.description.trim() : ''
                    });
                }
            })
            .on('end', () => resolve(products))
            .on('error', (err) => reject(err));
    });
}

async function buildSite() {
    try {
        console.log('🔄 Đang tải dữ liệu sản phẩm từ Google Sheet...');
        const products = await fetchProductsFromSheet();

        console.log(`📦 Đã tải thành công ${products.length} sản phẩm!`);

        // 1. Lưu bản backup vào thư mục data
        const dataDir = path.join(__dirname, 'data');
        if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);
        fs.writeFileSync(path.join(dataDir, 'products.json'), JSON.stringify(products, null, 2), 'utf8');

        // 2. Đọc template HTML gốc và tạo TRANG CHỦ (public/index.html)
        let template = fs.readFileSync(path.join(__dirname, 'src/template.html'), 'utf8');
        const injectedScript = `<script>const PRODUCTS = ${JSON.stringify(products, null, 2)};</script>`;
        const finalHtml = template.replace('<!-- INJECT_PRODUCTS_HERE -->', injectedScript);

        const publicDir = path.join(__dirname, 'public');
        if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir);
        fs.writeFileSync(path.join(publicDir, 'index.html'), finalHtml, 'utf8');

        // 3. TẠO CÁC TRANG CHI TIẾT SẢN PHẨM RIÊNG BIỆT (public/products/[id].html)
        const productsDir = path.join(publicDir, 'products');
        if (!fs.existsSync(productsDir)) fs.mkdirSync(productsDir, { recursive: true });

        const detailTemplatePath = path.join(__dirname, 'src/product-detail-template.html');
        if (fs.existsSync(detailTemplatePath)) {
            const detailTemplate = fs.readFileSync(detailTemplatePath, 'utf8');

            products.forEach(p => {
                const hasDiscount = p.originalPrice && p.originalPrice > p.price;
                const discountPercent = hasDiscount ? Math.round(((p.originalPrice - p.price) / p.originalPrice) * 100) : 0;

                let productHtml = detailTemplate
                    .replace(/{{PRODUCT_ID}}/g, p.id)
                    .replace(/{{PRODUCT_NAME}}/g, p.name)
                    .replace(/{{PRODUCT_IMAGE}}/g, p.image)
                    .replace(/{{PRODUCT_UNIT}}/g, p.unit || 'Cái')
                    .replace(/{{PRODUCT_PRICE}}/g, formatVND(p.price))
                    .replace(/{{PRODUCT_DESC}}/g, p.description || 'Chưa có mô tả cho sản phẩm này.')
                    .replace(/{{PRODUCT_JSON}}/g, JSON.stringify(p))
                    .replace(/{{HEAVY_BADGE}}/g, p.heavy ? `<span class="absolute top-3 left-3 bg-amber-500 text-white text-xs font-bold px-2.5 py-1 rounded-lg shadow">📦 Đồ nặng / cồng kềnh</span>` : '')
                    .replace(/{{DISCOUNT_BADGE}}/g, hasDiscount ? `<span class="absolute top-3 right-3 bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-lg shadow">-${discountPercent}%</span>` : '')
                    .replace(/{{ORIGINAL_PRICE_HTML}}/g, hasDiscount ? `<span class="text-base text-slate-400 line-through">${formatVND(p.originalPrice)}</span>` : '');

                fs.writeFileSync(path.join(productsDir, `${p.id}.html`), productHtml, 'utf8');
            });
            console.log(`🛍️ Đã sinh thành công ${products.length} trang HTML sản phẩm riêng biệt trong public/products/!`);
        }

        // 4. Copy file app.js sang thư mục public/js
        const publicJsDir = path.join(publicDir, 'js');
        if (!fs.existsSync(publicJsDir)) fs.mkdirSync(publicJsDir, { recursive: true });
        
        const srcAppJs = path.join(__dirname, 'src/js/app.js');
        const destAppJs = path.join(publicJsDir, 'app.js');
        if (fs.existsSync(srcAppJs)) {
            fs.copyFileSync(srcAppJs, destAppJs);
            console.log('✅ Đã copy app.js sang public/js/app.js!');
        }

        // 5. Tự động copy toàn bộ thư mục images sang public/images
        const srcImagesDir = path.join(__dirname, 'images');
        const destImagesDir = path.join(publicDir, 'images');
        if (fs.existsSync(srcImagesDir)) {
            if (!fs.existsSync(destImagesDir)) fs.mkdirSync(destImagesDir, { recursive: true });
            
            const imageFiles = fs.readdirSync(srcImagesDir);
            imageFiles.forEach(file => {
                fs.copyFileSync(path.join(srcImagesDir, file), path.join(destImagesDir, file));
            });
            console.log('🖼️ Đã copy thành công toàn bộ hình ảnh sang public/images!');
        }

        console.log('🎉 Đã build thành công toàn bộ website!');
    } catch (error) {
        console.error('❌ Lỗi khi build website:', error.message);
    }
}

buildSite();