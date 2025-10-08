const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { Storage } = require('@google-cloud/storage');
const vision = require('@google-cloud/vision');

admin.initializeApp();
const db = admin.firestore();
const storage = new Storage();
const client = new vision.ImageAnnotatorClient();

const OWNER_UID = 'm3h06woQv2V7lrNu1p8fDQCZ8IW2'; // seu UID

exports.moderatorSaleImage = functions.firestore
  .document('sales/{saleId}')
  .onCreate(async (snap, context) => {
    const data = snap.data();
    const saleId = context.params.saleId;
    const { userId, userName } = data;

    const bucketName = 'regras-ivad.firebasestorage.app'; // seu bucket
    const filePath = `sales_photos/${userId}/${saleId}`;
    const file = storage.bucket(bucketName).file(filePath);

    // Analisa a imagem
    const [result] = await client.safeSearchDetection(`gs://${bucketName}/${filePath}`);
    const safeSearchResult = result.safeSearchAnnotation;

    const isNSFW = (
        safeSearchResult.adult === 'VERY_LIKELY' || 
        safeSearchResult.adult === 'LIKELY' || 
        safeSearchResult.racy === 'VERY_LIKELY' || 
        safeSearchResult.racy === 'LIKELY'
    );

    if (isNSFW) {
        await file.delete().catch(err => console.error(err));
        await db.collection('bannedUsers').doc(userId).set({
            name: userName,
            reason: 'NSFW image detected by AI',
            bannedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        await snap.ref.update({ moderationStatus: 'banned', moderationReason: 'NSFW image detected' });
        console.log(`[BANIDO] Usuário ${userName} banido.`);
    } else {
        await snap.ref.update({ moderationStatus: 'approved' });
        console.log(`[APROVADO] Anúncio de ${userName} aprovado.`);
    }
});