const payments = require('./payments.cjs');
export const assertPaymentConfigured = payments.assertPaymentConfigured;
export const getOrCreateAsaasCustomer = payments.getOrCreateAsaasCustomer;
export const createCharge = payments.createCharge;
export const getPixQrCode = payments.getPixQrCode;
