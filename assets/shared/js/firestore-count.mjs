/* Modular Firestore aggregation bridge for the legacy compat application. */
import {
  collection,
  getCountFromServer,
  getFirestore,
  query,
  where
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';

window.mizanFirestoreCount = async function mizanFirestoreCount(collectionName, filters = []) {
  // The page initializes Firebase through the compat global API.
  // Resolve the default app through this module's own modular SDK registry;
  // never pass the compat wrapper's private _delegate across SDK surfaces.
  if (!window.firebase?.apps?.length) {
    throw new Error('Firebase application is not initialized.');
  }

  const firestore = getFirestore();
  const collectionRef = collection(firestore, collectionName);
  const constraints = filters.map(([field, operator, value]) => where(field, operator, value));
  const targetQuery = constraints.length ? query(collectionRef, ...constraints) : collectionRef;
  const snapshot = await getCountFromServer(targetQuery);
  return Number(snapshot.data().count) || 0;
};
