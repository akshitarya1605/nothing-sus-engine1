import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  await prisma.studentAccount.deleteMany({})
  await prisma.participant.deleteMany({})
  console.log('Wiped test data.')
}
main()
