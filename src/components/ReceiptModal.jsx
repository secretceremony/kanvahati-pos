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
                <div><strong>User:</strong> ${(transaction.cashier || "Staf").replace(/^Kasir\s+/i, '')}</div>
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
        <div className="receipt-modal-overlay fixed inset-0 bg-[#171717]/60 backdrop-blur-sm z-[10000] flex justify-center items-center opacity-100 pointer-events-auto transition-opacity duration-300 p-4">
            <div id="receipt-print-area" className="receipt-paper w-[330px] bg-white border-[3px] border-text shadow-[10px_10px_0px_#171717] relative flex flex-col animate-[ticketSlide_0.4s_cubic-bezier(0.175,0.885,0.32,1.15)_forwards]">
                {/* Washi Tape Strip at top of receipt */}
                <div className="tape-strip"></div>

                {/* Scallop Top */}
                <div className="receipt-scallop-top absolute top-[-12px] left-[-3px] right-[-3px]"></div>
                
                <div className="receipt-body p-6 text-text">
                    <div className="receipt-logo text-center mb-3">
                        <span className="receipt-logo-text font-title text-[20px] font-bold block text-text tracking-wide">Kanvahati POS</span>
                        <p className="text-[11px] font-tag font-bold opacity-75">{t.printedFrom}</p>
                    </div>
                    
                    <div className="receipt-divider border-t-2 border-dashed border-text/40 my-3"></div>
                    
                    <div className="receipt-meta text-[11.5px] font-body flex flex-col gap-1">
                        <div><strong className="font-tag uppercase tracking-wider text-[10px] text-text/70">{t.orderId}:</strong> {transaction.id}</div>
                        <div><strong className="font-tag uppercase tracking-wider text-[10px] text-text/70">{t.date}:</strong> {formattedDate}</div>
                        <div><strong className="font-tag uppercase tracking-wider text-[10px] text-text/70">{t.cashier || "User"}:</strong> {(transaction.cashier || "Staf").replace(/^Kasir\s+/i, '')}</div>
                    </div>

                    <div className="receipt-divider border-t-2 border-dashed border-text/40 my-3"></div>

                    {/* Items Purchased */}
                    <div className="receipt-items flex flex-col gap-2.5 text-[12px]">
                        {transaction.items && transaction.items.map((item, idx) => {
                            const hasDiscount = (item.discount || 0) > 0;
                            return (
                                <div key={idx} className="r-item-line flex justify-between items-start">
                                    <span className="r-item-title flex flex-col pr-2">
                                        <span className="font-bold">{item.qty}x {item.name}</span>
                                        {hasDiscount && (
                                            <span className="text-[9.5px] text-pink font-tag font-black">disc -{formatReceiptMoney(item.discount)}/pcs</span>
                                        )}
                                    </span>
                                    <span className="r-item-total font-title font-bold shrink-0">{formatReceiptMoney(item.price * item.qty)}</span>
                                </div>
                            );
                        })}
                    </div>

                    <div className="receipt-divider border-t-2 border-dashed border-text/40 my-3"></div>

                    {/* Totals Summary */}
                    <div className="receipt-summary flex flex-col gap-1 text-[12px]">
                        <div className="r-summary-row flex justify-between font-body">
                            <span>{t.subtotal}:</span>
                            <span className="font-bold">{formatReceiptMoney(transaction.subtotal || 0)}</span>
                        </div>
                        {transaction.appliedBundles && transaction.appliedBundles.length > 0 && transaction.appliedBundles.map((b, idx) => (
                            <div key={idx} className="r-summary-row flex justify-between text-pink font-tag font-bold text-[11px]">
                                <span>Promo: {b.bundleName}</span>
                                <span>-{formatReceiptMoney(b.discount)}</span>
                            </div>
                        ))}
                        <div className="r-summary-row font-title font-bold flex justify-between text-[16px] border-t-2 border-dashed border-text/40 pt-2 mt-1">
                            <span>{t.grandTotal}:</span>
                            <span className="text-text">{formatReceiptMoney(transaction.total || 0)}</span>
                        </div>
                        <div className="r-summary-row flex justify-between font-tag text-[11px] uppercase pt-1">
                            <span className="font-bold opacity-75">{t.method}:</span>
                            <span className="font-black bg-yellow px-2 py-0.2 rounded border border-text shadow-[1px_1px_0px_#171717]">
                                {transaction.paymentMethod === 'cash' ? t.cash : t.qris}
                            </span>
                        </div>
                    </div>

                    <div className="receipt-divider border-t-2 border-dashed border-text/40 my-3"></div>
                    
                    <div className="receipt-thankyou text-center mt-3.5 relative">
                        <div className="stamp-approved border-[2.5px] border-pink text-pink font-tag text-[12px] font-black uppercase px-2.5 py-1 rounded-md inline-block rotate-[-8deg] shadow-[2px_2px_0px_#171717] mb-2 bg-pink-light/30">
                            ★ {t.approved} ★
                        </div>
                        <p className="text-[12px] font-title font-bold">{t.thankYou}</p>
                        <p className="text-[10.5px] font-tag font-bold tracking-wider text-text/80 mt-1"><i className="fa-brands fa-instagram"></i> @kanvahati</p>
                    </div>
                </div>

                {/* Scallop Bottom */}
                <div className="receipt-scallop-bottom absolute bottom-[-12px] left-[-3px] right-[-3px]"></div>
                
                {/* Modal Buttons */}
                <div className="receipt-actions absolute bottom-[-75px] left-0 right-0 flex justify-center gap-3">
                    <button 
                        onClick={onClose} 
                        className="btn bg-white text-text border-[2.5px] border-text rounded-xl font-tag text-[12px] font-black uppercase tracking-wider px-5 py-2.5 shadow-[3px_3px_0px_#171717] hover:bg-yellow-light hover:translate-y-[-2px] hover:shadow-[4px_4px_0px_#171717] active:translate-y-[1px] active:shadow-[1px_1px_0px_#171717] transition-all cursor-pointer"
                    >
                        {t.close}
                    </button>
                    <button 
                        onClick={handleDownloadPDF} 
                        disabled={isGeneratingPdf}
                        className={`btn ${isGeneratingPdf ? 'bg-gray-300' : 'bg-yellow hover:bg-white hover:translate-y-[-2px] hover:shadow-[4px_4px_0px_#171717]'} text-text border-[2.5px] border-text rounded-xl font-tag text-[12px] font-black uppercase tracking-wider px-5 py-2.5 shadow-[3px_3px_0px_#171717] active:translate-y-[1px] active:shadow-[1px_1px_0px_#171717] transition-all cursor-pointer flex items-center gap-1.5`}
                    >
                        {isGeneratingPdf ? (
                            <><i className="fa-solid fa-spinner fa-spin text-xs"></i> Tunggu...</>
                        ) : (
                            <><i className="fa-solid fa-file-pdf text-xs"></i> PDF</>
                        )}
                    </button>
                    <button 
                        onClick={handlePrint} 
                        className="btn bg-pink text-text border-[2.5px] border-text rounded-xl font-tag text-[12px] font-black uppercase tracking-wider px-5 py-2.5 shadow-[3px_3px_0px_#171717] hover:bg-white hover:translate-y-[-2px] hover:shadow-[4px_4px_0px_#171717] active:translate-y-[1px] active:shadow-[1px_1px_0px_#171717] transition-all cursor-pointer flex items-center gap-1.5"
                    >
                        <i className="fa-solid fa-print text-xs"></i> {t.print}
                    </button>
                </div>
            </div>
        </div>
    );
}
