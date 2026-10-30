import { describe, expect, it } from '@jest/globals';

import { bankOf, gmailQuery, looksLikeMove, parseBankMail, subjectKey } from '../bankMail';

const mail = (from: string, subject: string, body: string) => ({ from, subject, body, date: '2026-10-29T15:30:00Z' });

describe('correos del banco', () => {
  it('reconoce el banco por el remitente', () => {
    expect(bankOf('BCI Notificaciones <avisos@bci.cl>')?.code).toBe('bci');
    expect(bankOf('MACH <hola@somosmach.com>')?.code).toBe('mach');
    expect(bankOf('Correo <alguien@gmail.com>')).toBeNull();
  });

  it('lee una compra con tarjeta: monto, comercio y los 4 últimos dígitos', () => {
    const r = parseBankMail(mail('Banco <notificaciones@bancoestado.cl>', 'Aviso de compra', 'Se realizó una compra por $12.990 en LIDER EXPRESS con tu tarjeta terminada en 4321 el 29/10/2026.'));
    expect(r).toEqual({ bank: 'BancoEstado', kind: 'expense', amount: 12990, merchant: 'LIDER EXPRESS', card: '4321', date: '2026-10-29' });
  });

  it('lee un abono como ingreso', () => {
    const r = parseBankMail(mail('Santander <mensajeria@santander.cl>', 'Te transfirieron dinero', 'Recibiste una transferencia de $250.000 de Juan Pérez.'));
    expect(r).toMatchObject({ kind: 'income', amount: 250000, merchant: 'Juan Pérez' });
  });

  it('acepta «Comercio:» en otra línea', () => {
    const r = parseBankMail(mail('Coopeuch <avisos@coopeuch.cl>', 'Compra con tarjeta de débito', 'Monto: $8.500\nComercio: COPEC RUTA 5'));
    expect(r).toMatchObject({ amount: 8500, merchant: 'COPEC RUTA 5' });
  });

  it('descarta promociones y correos sin monto', () => {
    expect(parseBankMail(mail('BCI <ofertas@bci.cl>', 'Ofertas exclusivas', 'Aprovecha descuentos de hasta $20.000 en tiendas'))).toBeNull();
    expect(parseBankMail(mail('BCI <avisos@bci.cl>', 'Tu clave fue cambiada', 'Cambiaste tu clave de acceso.'))).toBeNull();
  });

  it('arma la búsqueda de Gmail para los bancos elegidos', () => {
    expect(gmailQuery(['bci', 'coopeuch'])).toBe('(from:bci.cl OR from:coopeuch.cl)');
    expect(gmailQuery([])).toBe('');
  });
});

describe('solo movimientos, no promociones', () => {
  it('avisa solo lo que parece un movimiento', () => {
    expect(looksLikeMove({ subject: 'Comprobante de transferencia', body: 'Detalle adjunto' })).toBe(true);
    expect(looksLikeMove({ subject: 'Compra realizada con tu tarjeta', body: '' })).toBe(true);
    expect(looksLikeMove({ subject: 'Paga tus cuentas sin comisión', body: 'Aprovecha el pago automático' })).toBe(false);
    expect(looksLikeMove({ subject: 'Tu estado de cuenta ya está disponible', body: '' })).toBe(false);
  });
  it('la forma del asunto no cambia con los montos', () => {
    expect(subjectKey('Compra por $12.990 el 29-10')).toBe(subjectKey('Compra por $8.500 el 30-10'));
  });
});
