import 'dotenv/config'
import { readFile } from 'node:fs/promises'
import { firestore } from '../src/config/firebase.js'

const fixtureUrl = new URL('../data/mock-products.json', import.meta.url)
const products = JSON.parse(await readFile(fixtureUrl, 'utf8'))
const database = firestore()
const batch = database.batch()

for (const { id, ...product } of products) {
  batch.set(database.collection('products').doc(id), product)
}

await batch.commit()
console.log(`Seeded ${products.length} products into Firestore.`)
