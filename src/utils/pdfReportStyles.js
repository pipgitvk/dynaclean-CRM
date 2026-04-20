/** Shared CSS for html2canvas PDF reports (service + installation). */
export const PDF_REPORT_STYLES = `
            body {
                font-family: Arial, sans-serif;
                margin: 0;
                padding: 10px;
                font-size: 9px;
                line-height: 1.2;
            }

            .container {
                max-width: 800px;
                margin: 0 auto;
                border: 1px solid #000;
                padding: 10px;
            }

            .company-info {
                display: flex;
                align-items: flex-start;
                justify-content: left;
                margin-bottom: 10px;
                gap: 15px;
                font-size: 14px;
            }

            .logo {
                max-width: 120px;
                height: auto;
                text-align: left;
                vertical-align: middle;
            }

            .company-details h1 {
                color: #c41e3a;
                margin: 0 0 5px 0;
                font-size: 18px;
            }

            .company-details p {
                margin: 2px 0;
                font-size: 12px;
            }

            .contact-info {
                display: flex;
                align-items: center;
                margin: 1px 0;
            }

            .contact-info p {
                margin: 0;
                font-size: 12px;
            }

            .contact-info .icon {
                font-size: 10px;
                margin-right: 3px;
            }

            h2 {
                text-align: center;
                margin: 12px 0;
                font-size: 16px;
                color: #000;
            }

            h2.installation-report-title {
                text-decoration: underline;
                font-weight: bold;
            }

            table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 8px;
                border: 0.5px solid #666;
            }

            th, td {
                border: 0.5px solid #666;
                line-height: 2.3;
                padding: 3px;
                text-align: left;
                vertical-align: middle;
                font-size: 12px;
                color: #000;
            }

            .service-group {
                border: 1px solid #000;
                padding: 6px;
                margin: 6px 0;
            }

            .service-group h3 {
                color: #000;
                text-transform: uppercase;
                margin: 0 0 6px 0;
                font-size: 12px;
            }

            .form-group {
                display: flex;
                align-items: center;
                margin: 3px 0;
            }

            .form-group label {
                min-width: 100px;
                font-weight: bold;
                font-size: 12px;
            }
            .form-group span {
                min-width: 100px;
                font-size: 12px;
            }

            .checkbox-group {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 6px;
                margin: 6px 0;
                color: #000;
            }

            .checkbox-item {
                display: flex;
                align-items: center;
                font-size: 12px;
            }

            .checkbox-item input[type="checkbox"] {
                margin-right: 3px;
                transform: scale(0.8);
            }

            .signature-section {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 10px;
                margin-top: 10px;
            }

            .signature-group {
                border: 1px solid #000;
                padding: 6px;
                text-align: center;
            }

            .signature-box {
                border: 1px solid #000;
                height: 80px;
                margin: 6px 0;
                display: flex;
                align-items: center;
                justify-content: center;
                background-color: #f9f9f9;
            }

            .signature-details {
                text-align: left;
                font-size: 10px;
            }

            .signature-details div {
                margin: 1px 0;
            }

            .rating-section {
                margin: 6px 0;
            }

            .rating-options {
                display: flex;
                gap: 10px;
                margin: 3px 0;
                flex-wrap: wrap;
            }

            .rating-option {
                display: flex;
                align-items: center;
                font-size: 10px;
            }

            .rating-option input[type="radio"] {
                margin-right: 3px;
                transform: scale(0.8);
            }

            .install-status-row {
                display: flex;
                align-items: center;
                gap: 14px;
                flex-wrap: wrap;
                margin: 6px 0;
                font-size: 12px;
            }

            @media print {
                @page {
                    size: A4;
                    margin: 0.5in;
                }

                body {
                    font-size: 12px !important;
                }

                .container {
                    border: none;
                    padding: 0;
                }

                .signature-box {
                    height: 100px;
                }
            }
`;
