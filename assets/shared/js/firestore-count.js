/* Modular Firestore aggregation bridge for the legacy compat application. */
import {
  collection,
  getCountFromServer,
  getFirestore,
  query,
  where
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';

window.mizanFirestoreCount = async function mizanFirestoreCount(collectionName, filters = []) {
  const compatApp = window.firebase?.app?.();
  if (!compatApp?._delegate) {
    throw new Error('Firebase application is not initialized.');
  }

  const firestore = getFirestore(compatApp._delegate);
  const collectionRef = collection(firestore, collectionName);
  const constraints = filters.map(([field, operator, value]) => where(field, operator, value));
  const targetQuery = constraints.length ? query(collectionRef, ...constraints) : collectionRef;
  const snapshot = await getCountFromServer(targetQuery);
  return Number(snapshot.data().count) || 0;
};
