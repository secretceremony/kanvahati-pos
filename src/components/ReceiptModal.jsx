import React, { useState } from 'react';
import { t } from '../services/translations';

export default function ReceiptModal({ transaction, onClose, onPrint }) {
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

    if (!transaction) return null;

    const formattedDate = new Date(transaction.timestamp).toLocaleString();

    // Format all receipt values strictly in Indonesian Rupiah (Rp)
    const formatReceiptMoney = (value) => {
        return `Rp ${Math.round(value).toLocaleString('id-ID')}`;
    };

    const getCleanHtml = () => `
        <div style="font-family: Arial, sans-serif; padding: 20px; width: 280px; color: #000; background: #fff; margin: 0 auto; box-sizing: border-box;">
            <div style="text-align: center; margin-bottom: 15px;">
                <h3 style="margin: 0; font-size: 16px; font-weight: bold; letter-spacing: 1px;">KANVAHATI POS</h3>
                <p style="margin: 4px 0 0 0; font-size: 11px; color: #444;">Dicetak dari Kanvahati POS</p>
            </div>
            <hr style="border: none; border-top: 1.5px dashed #000; margin: 12px 0;" />
            <div style="font-size: 12px; line-height: 1.5;">
                <div><strong>ID Pesanan:</strong> ${transaction.id}</div>
                <div><strong>Tanggal:</strong> ${formattedDate}</div>
                <div><strong>Kasir:</strong> ${transaction.cashier || "Kasir Peach 🌸"}</div>
            </div>
            <hr style="border: none; border-top: 1.5px dashed #000; margin: 12px 0;" />
            <div style="font-size: 12px; line-height: 1.6;">
                ${(transaction.items || []).map(item => {
                    const hasDiscount = (item.discount || 0) > 0;
                    return `
                    <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                        <span style="flex: 1; padding-right: 10px;">${item.qty}x ${item.name}${hasDiscount ? ` <span style="color: #d81b60; font-size: 10px;">(disc -Rp ${item.discount.toLocaleString('id-ID')}/pcs)</span>` : ''}</span>
                        <span style="font-weight: bold; white-space: nowrap;">Rp ${(item.price * item.qty).toLocaleString('id-ID')}</span>
                    </div>
                `}).join('')}
            </div>
            <hr style="border: none; border-top: 1.5px dashed #000; margin: 12px 0;" />
            <div style="font-size: 12px; line-height: 1.5;">
                <div style="display: flex; justify-content: space-between;">
                    <span>Subtotal:</span>
                    <span>Rp ${(transaction.subtotal || 0).toLocaleString('id-ID')}</span>
                </div>
                ${(transaction.appliedBundles || []).map(b => `
                    <div style="display: flex; justify-content: space-between; color: #d81b60;">
                        <span>Promo: ${b.bundleName}</span>
                        <span>-Rp ${b.discount.toLocaleString('id-ID')}</span>
                    </div>
                `).join('')}
                <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 14px; margin-top: 8px; padding-top: 8px; border-top: 1px solid #000;">
                    <span>Total Akhir:</span>
                    <span>Rp ${(transaction.total || 0).toLocaleString('id-ID')}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-top: 4px;">
                    <span>Metode:</span>
                    <span style="font-weight: bold;">${transaction.paymentMethod === 'cash' ? 'TUNAI' : 'QRIS'}</span>
                </div>
            </div>
            <hr style="border: none; border-top: 1.5px dashed #000; margin: 15px 0;" />
            <div style="text-align: center; margin-top: 20px;">
                <p style="margin: 0; font-size: 12px; font-weight: bold;">Transaksi Selesai!</p>
                <p style="margin: 4px 0 0 0; font-size: 10px; color: #444;">@kanvahati</p>
            </div>
        </div>
    `;

    const handleDownloadPDF = () => {
        if (isGeneratingPdf) return;
        
        setIsGeneratingPdf(true);
        
        try {
            if (!window.html2pdf) {
                alert("Pustaka PDF (html2pdf) belum dimuat. Menggunakan print browser...");
                setIsGeneratingPdf(false);
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
            
            // Pass the raw HTML string directly! This creates a clean iframe without Tailwind v4's oklab CSS.
            window.html2pdf().from(getCleanHtml()).set(opt).save().then(() => {
                setIsGeneratingPdf(false);
            }).catch(e => {
                console.error("PDF generation failed:", e);
                alert("Error PDF: " + (e.message || JSON.stringify(e) || "Unknown Error"));
                setIsGeneratingPdf(false);
            });
        } catch (e) {
            console.error("PDF generation error:", e);
            alert("Gagal memulai unduhan PDF.");
            setIsGeneratingPdf(false);
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
                        @page { margin: 0; }
                        body { margin: 0; background: #fff; }
                    </style>
                </head>
                <body>
                    ${getCleanHtml()}
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
                        {transaction.items && transaction.items.map((item, idx) => {
                            const hasDiscount = (item.discount || 0) > 0;
                            return (
                                <div key={idx} className="r-item-line flex justify-between">
                                    <span className="r-item-title flex flex-col">
                                        <span>{item.qty}x {item.name}</span>
                                        {hasDiscount && (
                                            <span className="text-[9px] text-pink font-bold">disc -{formatReceiptMoney(item.discount)}/pcs</span>
                                        )}
                                    </span>
                                    <span className="r-item-total font-bold">{formatReceiptMoney(item.price * item.qty)}</span>
                                </div>
                            );
                        })}
                    </div>

                    <div className="receipt-divider border-t-2 border-dashed border-text my-2.5"></div>

                    {/* Totals Summary */}
                    <div className="receipt-summary flex flex-col gap-1 text-[12px]">
                        <div className="r-summary-row flex justify-between">
                            <span>{t.subtotal}:</span>
                            <span>{formatReceiptMoney(transaction.subtotal || 0)}</span>
                        </div>
                        {transaction.appliedBundles && transaction.appliedBundles.length > 0 && transaction.appliedBundles.map((b, idx) => (
                            <div key={idx} className="r-summary-row flex justify-between text-pink font-bold">
                                <span>Promo: {b.bundleName}</span>
                                <span>-{formatReceiptMoney(b.discount)}</span>
                            </div>
                        ))}
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
                        disabled={isGeneratingPdf}
                        className={`btn ${isGeneratingPdf ? 'bg-gray-300' : 'bg-yellow hover:bg-white hover:translate-y-[-3px] hover:shadow-[5px_5px_0px_#32628f]'} text-text border-[3px] border-text rounded-full font-title text-[14px] px-6 py-2 shadow-btn active:translate-y-[1px] active:shadow-[2px_2px_0px_#32628f] transition-all cursor-pointer flex items-center gap-2`}
                    >
                        {isGeneratingPdf ? (
                            <><i className="fa-solid fa-spinner fa-spin text-xs"></i> Tunggu...</>
                        ) : (
                            <><i className="fa-solid fa-file-pdf text-xs"></i> PDF</>
                        )}
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
