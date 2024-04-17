import { db } from "../db/db.js";
import fetch from 'node-fetch'; 
import cheerio from 'cheerio';
import nodemailer from 'nodemailer';

export const buscarCargas = async (req, userId) => {
    const { parametro1, parametro2, salvarNoBanco } = req.body;

    const url = `https://www.tapcargo.com/en/Tracking-Results?countryCode=${parametro1}&consignmentNote=${parametro2}`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error('Erro ao buscar os dados. Status da resposta: ' + response.status);
        }

        const html = await response.text();
        const $ = cheerio.load(html);

        const targetSection = $('p.txt-ms-regular:contains("State")').closest('section');
        const stateValue = $('p.txt-ms-regular:contains("State")').closest('div.row').find('p.txt-ms-bold').text().trim().split(',').slice(0, 2).join(',');
        const departureValue = targetSection.find('p.txt-ms-regular:contains("Departure")').next().text().trim();
        const arrivalValue = targetSection.find('p.txt-ms-regular:contains("Arrival")').next().text().trim();

        const currentData = { state: stateValue, departure: departureValue, arrival: arrivalValue };

        const tableRows = $('.flytap-simple-table-type-two table tbody tr');

        if (tableRows.length === 0) {
            throw new Error('Nenhuma linha de tabela encontrada na resposta');
        }

        const tableData = [];
        const columnNames = [];

        $(tableRows[0]).find('td').each((i, cell) => {
            const columnName = $(cell).text().trim();
            columnNames.push(columnName);
        });

        for (let i = 1; i < tableRows.length; i++) {
            const rowData = {};
            const currentRow = tableRows[i];
            $(currentRow).find('td').each((j, cell) => {
                const cellText = $(cell).text().trim();
                rowData[columnNames[j]] = cellText;
            });
            tableData.push(rowData);
        }

        const jsonData = {
            DadosAtuais: currentData,
            Historico: tableData
        };

        if (salvarNoBanco) {
            await salvarCargas(userId, parametro1, parametro2, jsonData);
        }

      return jsonData;
    } catch (error) {
        throw new Error(error.message);
    }
};

export const buscarCargasAuto = async (parametro1, parametro2) => {
    const userId = '';

    const url = `https://www.tapcargo.com/en/Tracking-Results?countryCode=${parametro1}&consignmentNote=${parametro2}`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error('Erro ao buscar os dados. Status da resposta: ' + response.status);
        }

        const html = await response.text();
        const $ = cheerio.load(html);

        const targetSection = $('p.txt-ms-regular:contains("State")').closest('section');
        const stateValue = $('p.txt-ms-regular:contains("State")').closest('div.row').find('p.txt-ms-bold').text().trim().split(',').slice(0, 2).join(',');
        const departureValue = targetSection.find('p.txt-ms-regular:contains("Departure")').next().text().trim();
        const arrivalValue = targetSection.find('p.txt-ms-regular:contains("Arrival")').next().text().trim();

        const currentData = { state: stateValue, departure: departureValue, arrival: arrivalValue };

        const tableRows = $('.flytap-simple-table-type-two table tbody tr');

        if (tableRows.length === 0) {
            throw new Error('Nenhuma linha de tabela encontrada na resposta');
        }

        const tableData = [];
        const columnNames = [];

        $(tableRows[0]).find('td').each((i, cell) => {
            const columnName = $(cell).text().trim();
            columnNames.push(columnName);
        });

        for (let i = 1; i < tableRows.length; i++) {
            const rowData = {};
            const currentRow = tableRows[i];
            $(currentRow).find('td').each((j, cell) => {
                const cellText = $(cell).text().trim();
                rowData[columnNames[j]] = cellText;
            });
            tableData.push(rowData);
        }

        const jsonData = {
            DadosAtuais: currentData,
            Historico: tableData
        };

        return jsonData;
    } catch (error) {
        throw new Error(error.message);
    }
};

export const salvarCargas = async (userId, countryCode, consignmentNote, data) => {
    try {
        const codigo = countryCode + '-' + consignmentNote;
        const { state, departure, arrival } = data.DadosAtuais;
        const ultimoHistorico = data.Historico[data.Historico.length - 1];
        
        const { Flight, Weight, Reservation } = ultimoHistorico;

        const checkQuery = `
            SELECT * FROM cargas
            WHERE numCodigoAereo = $1 AND user_id = $2
        `;
        const checkResult = await db.query(checkQuery, [codigo, userId]);

        if (checkResult.rows.length > 0) {
            throw new Error('Os dados já foram salvos anteriormente');
        } else {
            const insertQuery = `
                INSERT INTO cargas (user_id, numCodigoAereo, StatusAtual, partida, chegada, flight, weight, reservation)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `;
            const values = [userId, codigo, state, departure, arrival, Flight, Weight, Reservation];

            await db.query(insertQuery, values);
        }
    } catch (error) {
        throw new Error(error.message);
    }
};

export const getAllCargas = async (userId) => {
    try {
        const query = `
            SELECT * FROM cargas
            WHERE user_id = $1
        `;
        const result = await db.query(query, [userId]);
        return result.rows;
    } catch (error) {
        throw new Error('Erro ao obter cargas salvas: ' + error.message);
    }
};

export const getCargasById = async (userId, numCodigoAereo) => {
    try {
        const query = `
            SELECT * FROM cargas
            WHERE user_id = $1 AND numCodigoAereo = $2
        `;
        const result = await db.query(query, [userId, numCodigoAereo]);
        return result.rows[0];
    } catch (error) {
        throw new Error('Erro ao buscar carga por código aéreo: ' + error.message);
    }
};

export const deleteCargasById = async (userId, numCodigoAereo) => {
    try {
        const query = `
            DELETE FROM cargas
            WHERE user_id = $1 AND numCodigoAereo = $2
        `;
        const result = await db.query(query, [userId, numCodigoAereo]);
        return result.rows[0];
    } catch (error) {
        throw new Error('Erro ao buscar carga por código aéreo: ' + error.message);
    }
};


export const enviarEmail = async (destinatario, assunto, corpo) => {
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: 'redefinirsenha1983@gmail.com',
            pass: 'vtaysanamhtagphi'
        }
    });

    const mailOptions = {
        from: 'redefinirsenha1983@gmail.com',
        to: destinatario,
        subject: assunto,
        html: corpo
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log('E-mail enviado com sucesso para', destinatario);
    } catch (error) {
        console.error('Erro ao enviar e-mail:', error);
    }
};


export const updateSaveCargas = async () => {
    try {
        const selectQuery = `
            SELECT c.*, u.email FROM cargas c JOIN users u ON c.user_id = u.id
        `;
        
        const { rows } = await db.query(selectQuery);
        
        if (rows && rows.length > 0) {
            for (const row of rows) {
                if (row.numcodigoaereo) {
                    const [parametro1, parametro2] = row.numcodigoaereo.split('-');
                    
                    const trackingData = await buscarCargasAuto(parametro1, parametro2);

                    if (trackingData) {
                        const ultimoHistorico = trackingData.Historico[trackingData.Historico.length - 1];        
                        const { Flight, Weight, Reservation } = ultimoHistorico;
                        const { state, departure, arrival } = trackingData.DadosAtuais;

                        if (
                            row.statusatual !== state ||
                            row.partida !== departure ||
                            row.chegada !== arrival ||
                            row.flight !== Flight ||
                            row.weight !== Weight ||
                            row.reservation !== Reservation
                        ) {
                            const updateQuery = `
                                UPDATE cargas
                                SET statusatual = $1, partida = $2, chegada = $3, flight = $4, weight = $5, reservation = $6
                                WHERE id = $7
                            `;
                            const values = [state, departure, arrival, Flight, Weight, Reservation, row.id];
    
                            await db.query(updateQuery, values);

                            console.log('Dados atualizados com sucesso para', row.numcodigoaereo);

                            const destinatario = row.email;
                            const assunto = `Atualização de Carga: ${row.numcodigoaereo}`;
                            const corpo = `
                            <html lang="pt-br">
                            <head>
                                <meta charset="UTF-8">
                                <link rel="stylesheet"
                                    href="https://fonts.googleapis.com/css2?family=Ubuntu+Mono:ital,wght@0,400;0,700;1,400;1,700&display=swap">
                                <style>
                                    body {
                                        font-family: 'Ubuntu Mono', monospace;
                                    }
                                </style>
                            </head>
                            <body style="margin: 20px; display: grid; justify-content: center;">
                                <div style="display: flex; align-items: center; height: 100px; margin-bottom: 20px;">
                                    <p style="rotate: -45deg; font-size: 5rem; margin: 0;">✈️</p>
                                    <h1 style="color: #333; margin-left: 10px; font-size: 3rem;">Atualização de Carga</h1>
                                </div>
                                <div style="margin: 40px;">
                                    <p style="font-size: 1.5rem;">Carga número <span style="font-weight: bold;">${row.numcodigoaereo}</span> teve
                                        atualização:
                                    </p>
                                    <div style="font-size: 1.25rem;">
                                        <div style="margin-left: 20px;">
                                            <p>Status: <span style="font-weight: bold; color: #5cd26f;"> ${state}</span></p>
                                            <p>Partida: <span style="font-weight: bold;"> ${departure}</span></p>
                                            <p>Chegada: <span style="font-weight: bold;"> ${arrival}</span></p>
                                            <p>Voo: <span style="font-weight: bold;"> ${Flight}</span></p>
                                            <p>Reserva: <span style="font-weight: bold;"> ${Reservation}</span></p>
                                        </div>
                                    </div>
                                </div>
                            </body>
                            </html>
                            `;
                            
                            await enviarEmail(destinatario, assunto, corpo);
                        } else {
                        }
                    } else {
                        console.error('Nenhum dado retornado para', row.numcodigoaereo);
                    }
                } else {
                    console.error('O campo numconhecimentoaereo está vazio ou indefinido para o registro:', row);
                }
            }
        } else {
            console.log('Não foram encontrados itens salvos na tabela cargas.');
        }
    } catch (error) {
        console.error('Erro ao buscar e atualizar os itens salvos:', error.message);
    }
};

setInterval(updateSaveCargas, 300000);

updateSaveCargas();