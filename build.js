const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');
const csv = require('csv-parser');

// Link export CSV trực tiếp từ Google Sheet của anh
const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/1G2OEe6Un6xms2vGLjhOqeQn8wTBx5AGSPU0nrcUwn6s/export?format=csv&gid=0';

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

        // Lưu bản backup vào thư mục data
        const dataDir = path.join(__dirname, 'data');
        if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);
        fs.writeFileSync(path.join(dataDir, 'products.json'), JSON.stringify(products, null, 2), 'utf8');

        // Đọc template HTML gốc
        let template = fs.readFileSync(path.join(__dirname, 'src/template.html'), 'utf8');

        // Inject dữ liệu sản phẩm vào template
        const injectedScript = `<script>const PRODUCTS = ${JSON.stringify(products, null, 2)};</script>`;
        const finalHtml = template.replace('<!-- INJECT_PRODUCTS_HERE -->', injectedScript);

        // Ghi file kết quả ra thư mục public
        const publicDir = path.join(__dirname, 'public');
        if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir);
        fs.writeFileSync(path.join(publicDir, 'index.html'), finalHtml, 'utf8');

        // Copy file app.js sang thư mục public/js
        const publicJsDir = path.join(publicDir, 'js');
        if (!fs.existsSync(publicJsDir)) fs.mkdirSync(publicJsDir, { recursive: true });
        
        const srcAppJs = path.join(__dirname, 'src/js/app.js');
        const destAppJs = path.join(publicJsDir, 'app.js');
        if (fs.existsSync(srcAppJs)) {
            fs.copyFileSync(srcAppJs, destAppJs);
            console.log('✅ Đã copy app.js sang public/js/app.js!');
        }

        // Tự động copy toàn bộ thư mục images sang public/images
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

        console.log('✅ Đã build thành công toàn bộ website!');
    } catch (error) {
        console.error('❌ Lỗi khi build website:', error.message);
    }
}

buildSite();