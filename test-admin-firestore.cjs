const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const path = require('path');
const fs = require('fs');

const jsonPath = path.join(__dirname, 'serviceAccountKey.json');

if (!fs.existsSync(jsonPath)) {
  console.error("❌ ERRO: O arquivo 'serviceAccountKey.json' não existe na raiz do projeto.");
  process.exit(1);
}

try {
  const serviceAccount = require(jsonPath);

  if (getApps().length === 0) {
    initializeApp({
      credential: cert(serviceAccount)
    });
  }
  console.log("🔥 Firebase Admin SDK inicializado com sucesso via JSON!");
} catch (err) {
  console.error("❌ Erro ao inicializar o Firebase Admin:", err.message);
  process.exit(1);
}

const db = getFirestore();

async function testAdminRead() {
  console.log("--------------------------------------------------");
  console.log("🔎 TESTANDO LEITURA NO FIRESTORE REAL (base-total)");
  console.log("--------------------------------------------------\n");

  const collections = ['orders', 'users', 'clients', 'coupons', 'orderTracking'];

  for (const colName of collections) {
    try {
      const snapshot = await db.collection(colName).limit(3).get();
      console.log(`📦 Coleção '${colName}': ${snapshot.size} documento(s) encontrado(s).`);

      snapshot.forEach((doc) => {
        console.log(`   - [ID: ${doc.id}]`, JSON.stringify(doc.data()).substring(0, 90) + "...");
      });
    } catch (err) {
      console.error(`❌ Erro ao acessar a coleção '${colName}':`, err.message);
    }
    console.log("");
  }
  console.log("--------------------------------------------------");
}

testAdminRead();
