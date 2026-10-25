// Khởi tạo giỏ hàng từ localStorage hoặc mảng rỗng
let cart = JSON.parse(localStorage.getItem('cart')) || [];

// ⚠️ THAY ĐƯỜNG DẪN WEB APP URL CỦA BẠN VÀO GIỮA CẶP DẤU NHÁY ĐƠN DƯỚI ĐÂY:
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzcj2GtN6L6nr8FpIQXP8vxRXdjJ42-_uLjZ3KNHrwY7f1b02e9XvbL4pG_utA3538xrQ/exec';

// Khi trang web tải xong
document.addEventListener('DOMContentLoaded', () => {
    if (typeof renderProducts === 'function') renderProducts();
    if (typeof updateCartUI === 'function') updateCartUI();

    // Lắng nghe sự kiện nút đặt hàng
    const checkoutBtn = document.getElementById('checkout-btn');
    if (checkoutBtn) {
        checkoutBtn.addEventListener('click', handleCheckout);
    }
});

// Hàm xử lý khi khách hàng bấm nút Đặt Hàng
function handleCheckout(e) {
    if (e) e.preventDefault();

    // 1. Kiểm tra giỏ hàng rỗng
    if (!cart || cart.length === 0) {
        alert('Giỏ hàng của bạn đang trống! Vui lòng chọn sản phẩm trước khi đặt hàng.');
        return;
    }

    // 2. Lấy thông tin từ các ô nhập liệu trên giao diện (sử dụng fallback nếu ô bị bỏ trống)
    const customerName = document.getElementById('customer-name')?.value.trim() || 
                         document.getElementById('customerName')?.value.trim() || 'Khách lẻ';
    
    const customerPhone = document.getElementById('customer-phone')?.value.trim() || 
                          document.getElementById('customerPhone')?.value.trim() || 'N/A';
    
    const customerAddress = document.getElementById('customer-address')?.value.trim() || 
                            document.getElementById('customerAddress')?.value.trim() || 'N/A';
    
    const deliveryTime = document.getElementById('delivery-time')?.value || 
                         document.getElementById('deliveryTime')?.value || 'Cuối tuần này';
    
    const paymentMethod = document.getElementById('payment-method')?.value || 
                          document.getElementById('paymentMethod')?.value || 'Tiền mặt';

    // 3. Tính tổng tiền đơn hàng
    const totalAmount = cart.reduce((sum, item) => sum + ((item.price || 0) * (item.quantity || 1)), 0);

    // 4. Tạo đối tượng dữ liệu đơn hàng
    const orderData = {
        maDon: "DH" + Math.floor(100000 + Math.random() * 900000), // Tạo mã đơn ngẫu nhiên ví dụ DH123456
        tenKhach: customerName,
        soDienThoai: customerPhone,
        diaChi: customerAddress,
        lichGiao: deliveryTime,
        thanhToan: paymentMethod,
        tongTien: totalAmount,
        chiTiet: cart.map(item => ({
            name: item.name || item.title || 'Sản phẩm',
            price: item.price || 0,
            quantity: item.quantity || 1,
            unit: item.unit || 'Cái'
        }))
    };

    // Vô hiệu hóa nút đặt hàng tạm thời để tránh khách bấm nhiều lần
    const checkoutBtn = document.getElementById('checkout-btn');
    if (checkoutBtn) checkoutBtn.disabled = true;

    // 5. Gửi dữ liệu bằng fetch POST sang Google Apps Script
    fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors', // Bắt buộc có để không bị lỗi CORS chặn request
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(orderData)
    })
    .then(() => {
        alert('🎉 Đặt hàng thành công! Cảm ơn bạn đã ủng hộ Bách Hóa Cuối Tuần.');
        
        // Cập nhật lại giỏ hàng sau khi đặt thành công
        cart = [];
        localStorage.removeItem('cart');
        if (typeof updateCartUI === 'function') updateCartUI();

        // Reset form nhập liệu nếu có
        const orderForm = document.getElementById('orderForm') || document.getElementById('checkout-form');
        if (orderForm) orderForm.reset();
    })
    .catch(error => {
        console.error('Lỗi khi gửi đơn hàng:', error);
        alert('Có lỗi xảy ra khi kết nối. Vui lòng thử lại!');
    })
    .finally(() => {
        if (checkoutBtn) checkoutBtn.disabled = false;
    });
}