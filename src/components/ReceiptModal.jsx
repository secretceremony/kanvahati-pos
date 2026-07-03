import React from 'react';
import { t } from '../services/translations';

export default function ReceiptModal({ transaction, onClose, onPrint }) {
    if (!transaction) return null;

    const formattedDate = new Date(transaction.timestamp).toLocaleString();

    // Format all receipt values strictly in Indonesian Rupiah (Rp)
    const formatReceiptMoney = (value) => {
        return `Rp ${Math.round(value).toLocaleString('id-ID')}`;
    };

    const handleDownloadPDF = () => {
        const element = document.getElementById('receipt-print-area');
        if (!element) return;
        
        try {
            if (!window.html2pdf) {
                alert("Pustaka PDF (html2pdf) belum dimuat. Menggunakan print browser...");
                handlePrint();
                return;
            }
            
            const opt = {
                margin:       0.2,
                filename:     `struk-${transaction.id}.pdf`,
                image:        { type: 'jpeg', quality: 0.98 },
                html2canvas:  { scale: 2, useCORS: true },
                jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
            };
            
            window.html2pdf().from(element).set(opt).save();
        } catch (e) {
            console.error("PDF generation failed, falling back to print", e);
            alert("Gagal mengunduh PDF, menggunakan printer...");
            handlePrint();
        }
    };

    const handlePrint = () => {
        const printWindow = window.open('', '_blank', 'width=350,height=600');
        if (!printWindow) {
            alert("Pop-up diblokir oleh browser! Harap izinkan pop-up untuk mencetak.");
            return;
        }

        printWindow.document.write(`
            <html>
                <head>
                    <title>Cetak Struk ${transaction.id}</title>
                    <style>
                        @page {
                            margin: 0;
                        }
                        body {
                            font-family: 'Courier New', Courier, monospace;
                            padding: 15px;
                            width: 280px;
                            font-size: 12px;
                            color: #000;
                            margin: 0 auto;
                        }
                        .text-center { text-align: center; }
                        .mb-2 { margin-bottom: 8px; }
                        .mb-3 { margin-bottom: 12px; }
                        .my-2 { margin-top: 8px; margin-bottom: 8px; }
                        .font-bold { font-weight: bold; }
                        .flex { display: flex; }
                        .justify-between { justify-content: space-between; }
                        .border-dashed { border-top: 1.5px dashed #000; }
                    </style>
                </head>
                <body>
                    <div class="text-center mb-3">
                        <h3 style="margin: 0; font-size: 15px; letter-spacing: 1px;">KANVAHATI POS</h3>
                        <p style="margin: 3px 0 0 0; font-size: 10px;">Dicetak dari Kanvahati POS</p>
                    </div>
                    <div class="border-dashed my-2"></div>
                    <div style="font-size: 11px; line-height: 1.4;">
                        <div><strong>ID Pesanan:</strong> ${transaction.id}</div>
                        <div><strong>Tanggal:</strong> ${formattedDate}</div>
                        <div><strong>Kasir:</strong> ${transaction.cashier || "Kasir Peach 🌸"}</div>
                    </div>
                    <div class="border-dashed my-2"></div>
                    <div style="line-height: 1.5;">
                        ${(transaction.items || []).map(item => `
                            <div class="flex justify-between">
                                <span style="max-width: 190px; word-wrap: break-word;">${item.qty}x ${item.name}</span>
                                <span class="font-bold">Rp ${(item.price * item.qty).toLocaleString('id-ID')}</span>
                            </div>
                        `).join('')}
                    </div>
                    <div class="border-dashed my-2"></div>
                    <div style="font-size: 11px; line-height: 1.4;">
                        <div class="flex justify-between">
                            <span>Subtotal:</span>
                            <span>Rp ${(transaction.subtotal || 0).toLocaleString('id-ID')}</span>
                        </div>
                        <div class="flex justify-between font-bold" style="font-size: 13px; margin-top: 5px; border-top: 1px solid #000; padding-top: 5px;">
                            <span>Total Akhir:</span>
                            <span>Rp ${(transaction.total || 0).toLocaleString('id-ID')}</span>
                        </div>
                        <div class="flex justify-between" style="margin-top: 4px;">
                            <span>Metode:</span>
                            <span class="font-bold">${transaction.paymentMethod === 'cash' ? 'TUNAI' : 'QRIS'}</span>
                        </div>
                    </div>
                    <div class="border-dashed my-2" style="margin-top: 15px;"></div>
                    <div class="text-center" style="margin-top: 15px;">
                        <div style="border: 2px solid #000; display: inline-block; padding: 3px 8px; font-weight: bold; transform: rotate(-5deg); margin-bottom: 8px; font-size: 12px;">
                            DISETUJUI
                        </div>
                        <p style="margin: 0; font-size: 10px; font-weight: bold;">Transaksi Selesai!</p>
                        <p style="margin: 4px 0 0 0; font-size: 9px; opacity: 0.8;">@kanvahati</p>
                    </div>
                    <script>
                        window.onload = function() {
                            window.print();
                            setTimeout(function() {
                                window.close();
                            }, 500);
                        };
                    </script>
                </body>
            </html>
        `);
        printWindow.document.close();
    };

    return (
        <div className="receipt-modal-overlay fixed inset-0 bg-[#32628F]/45 backdrop-blur-sm z-[10000] flex justify-center items-center opacity-100 pointer-events-auto transition-opacity duration-300">
            <div id="receipt-print-area" className="receipt-paper w-[320px] bg-white border-[3px] border-text shadow-[10px_10px_0px_#32628f] relative flex flex-col animate-[ticketSlide_0.4s_cubic-bezier(0.175,0.885,0.32,1.15)_forwards]">
                {/* Scallop Top */}
                <div className="receipt-scallop-top absolute top-[-12px] left-[-3px] right-[-3px]"></div>
                
                <div className="receipt-body p-5 text-text">
                    <div className="receipt-logo text-center mb-3">
                        <span className="receipt-logo-text font-title text-[18px] block">Kanvahati POS</span>
                        <p className="text-[11px] opacity-80">{t.printedFrom}</p>
                    </div>
                    
                    <div className="receipt-divider border-t-2 border-dashed border-text my-2.5"></div>
                    
                    <div className="receipt-meta text-[11px] flex flex-col gap-1">
                        <div><strong>{t.orderId}:</strong> {transaction.id}</div>
                        <div><strong>{t.date}:</strong> {formattedDate}</div>
                        <div><strong>{t.cashier}:</strong> {transaction.cashier || "Kasir Peach 🌸"}</div>
                    </div>

                    <div className="receipt-divider border-t-2 border-dashed border-text my-2.5"></div>

                    {/* Items Purchased */}
                    <div className="receipt-items flex flex-col gap-2 text-[12px]">
                        {transaction.items && transaction.items.map((item, idx) => (
                            <div key={idx} className="r-item-line flex justify-between">
                                <span className="r-item-title">{item.qty}x {item.name}</span>
                                <span className="r-item-total font-bold">{formatReceiptMoney(item.price * item.qty)}</span>
                            </div>
                        ))}
                    </div>

                    <div className="receipt-divider border-t-2 border-dashed border-text my-2.5"></div>

                    {/* Totals Summary */}
                    <div className="receipt-summary flex flex-col gap-1 text-[12px]">
                        <div className="r-summary-row flex justify-between">
                            <span>{t.subtotal}:</span>
                            <span>{formatReceiptMoney(transaction.subtotal || 0)}</span>
                        </div>
                        <div className="r-summary-row font-bold flex justify-between text-[15px] border-t border-text/20 pt-1.5 mt-1">
                            <span>{t.grandTotal}:</span>
                            <span>{formatReceiptMoney(transaction.total || 0)}</span>
                        </div>
                        <div className="r-summary-row flex justify-between">
                            <span>{t.method}:</span>
                            <span className="uppercase font-bold">
                                {transaction.paymentMethod === 'cash' ? t.cash : t.qris}
                            </span>
                        </div>
                    </div>

                    <div className="receipt-divider border-t-2 border-dashed border-text my-2.5"></div>
                    
                    <div className="receipt-thankyou text-center mt-3.5 relative">
                        <div className="stamp-approved border-3 border-pink text-pink font-title text-[14px] font-bold px-2 py-1 rounded inline-block rotate-[-10deg] opacity-85 mb-2">
                            {t.approved}
                        </div>
                        <p className="text-[11px] font-bold">{t.thankYou}</p>
                        <p className="text-[10px] opacity-75 mt-1.5 font-bold tracking-wider text-text/80"><i className="fa-brands fa-instagram"></i> @kanvahati</p>
                    </div>
                </div>

                {/* Scallop Bottom */}
                <div className="receipt-scallop-bottom absolute bottom-[-12px] left-[-3px] right-[-3px]"></div>
                
                {/* Modal Buttons */}
                <div className="receipt-actions absolute bottom-[-80px] left-0 right-0 flex justify-center gap-4">
                    <button 
                        onClick={onClose} 
                        className="btn bg-white text-text border-[3px] border-text rounded-full font-title text-[14px] px-6 py-2 shadow-btn hover:bg-blue-light hover:translate-y-[-3px] hover:shadow-[5px_5px_0px_#32628f] active:translate-y-[1px] active:shadow-[2px_2px_0px_#32628f] transition-all cursor-pointer"
                    >
                        {t.close}
                    </button>
                    <button 
                        onClick={handleDownloadPDF} 
                        className="btn bg-yellow text-text border-[3px] border-text rounded-full font-title text-[14px] px-6 py-2 shadow-btn hover:bg-white hover:translate-y-[-3px] hover:shadow-[5px_5px_0px_#32628f] active:translate-y-[1px] active:shadow-[2px_2px_0px_#32628f] transition-all cursor-pointer flex items-center gap-2"
                    >
                        <i className="fa-solid fa-file-pdf text-xs"></i> PDF
                    </button>
                    <button 
                        onClick={handlePrint} 
                        className="btn bg-pink text-text border-[3px] border-text rounded-full font-title text-[14px] px-6 py-2 shadow-btn hover:bg-white hover:translate-y-[-3px] hover:shadow-[5px_5px_0px_#32628f] active:translate-y-[1px] active:shadow-[2px_2px_0px_#32628f] transition-all cursor-pointer flex items-center gap-2"
                    >
                        <i className="fa-solid fa-print text-xs"></i> {t.print}
                    </button>
                </div>
            </div>
        </div>
    );
}
