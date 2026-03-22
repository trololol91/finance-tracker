import 'dotenv/config';
import {PrismaClient} from '../src/generated/prisma/client.js';
import {PrismaPg} from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import {DEFAULT_CATEGORIES} from '../src/categories/default-categories.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is not set');

const adapter = new PrismaPg({connectionString});
const prisma = new PrismaClient({adapter});

async function main(): Promise<void> {
    console.log('Seeding database...');

    const saltRounds = 10;

    // Admin user
    const adminEmail = 'admin@example.com';
    const adminRawPassword = process.env.SEED_ADMIN_PASSWORD ?? 'Admin123!';
    const adminPassword = await bcrypt.hash(adminRawPassword, saltRounds);

    const admin = await prisma.user.upsert({
        where: {email: adminEmail},
        update: {role: 'ADMIN'},
        create: {
            email: adminEmail,
            passwordHash: adminPassword,
            firstName: 'Admin',
            lastName: 'User',
            role: 'ADMIN',
            timezone: 'UTC',
            currency: 'USD'
        }
    });

    console.log(`Admin user seeded (id: ${admin.id})`);

    await prisma.category.createMany({
        data: DEFAULT_CATEGORIES.map(c => ({
            userId: admin.id,
            name: c.name,
            color: c.color,
            icon: c.icon,
            isActive: true
        })),
        skipDuplicates: true
    });
    console.log(`Seeded ${DEFAULT_CATEGORIES.length} default categories for admin`);

    // Regular user
    const userEmail = 'user@example.com';
    const userRawPassword = process.env.SEED_USER_PASSWORD ?? 'User123!';
    const userPassword = await bcrypt.hash(userRawPassword, saltRounds);

    const user = await prisma.user.upsert({
        where: {email: userEmail},
        update: {},
        create: {
            email: userEmail,
            passwordHash: userPassword,
            firstName: 'Jane',
            lastName: 'Doe',
            role: 'USER',
            timezone: 'America/New_York',
            currency: 'USD'
        }
    });

    console.log(`Regular user seeded (id: ${user.id})`);

    // Accounts for regular user
    const chequing = await prisma.account.upsert({
        where: {id: 'aaaaaaaa-0000-0000-0000-000000000001'},
        update: {},
        create: {
            id: 'aaaaaaaa-0000-0000-0000-000000000001',
            userId: user.id,
            name: 'Chequing',
            type: 'checking',
            institution: 'TD Bank',
            currency: 'USD',
            openingBalance: 5000,
            color: '#3B82F6'
        }
    });

    const savings = await prisma.account.upsert({
        where: {id: 'aaaaaaaa-0000-0000-0000-000000000002'},
        update: {},
        create: {
            id: 'aaaaaaaa-0000-0000-0000-000000000002',
            userId: user.id,
            name: 'Savings',
            type: 'savings',
            institution: 'TD Bank',
            currency: 'USD',
            openingBalance: 8000,
            color: '#10B981'
        }
    });

    console.log(`Accounts: ${chequing.name}, ${savings.name}`);

    // Categories
    await prisma.category.createMany({
        data: DEFAULT_CATEGORIES.map(c => ({
            userId: user.id,
            name: c.name,
            color: c.color,
            icon: c.icon,
            isActive: true
        })),
        skipDuplicates: true
    });
    console.log(`Seeded ${DEFAULT_CATEGORIES.length} default categories`);

    const getCat = (name: string) => prisma.category.findFirstOrThrow({where: {userId: user.id, name}});
    const salaryCat = await getCat('Income');
    const groceriesCat = await getCat('Food & Dining');
    const utilitiesCat = await getCat('Housing');

    // Transactions (current month)
    const now = new Date();
    const yr = now.getFullYear();
    const mo = now.getMonth();

    const transactions = [
        {
            userId: user.id,
            accountId: chequing.id,
            categoryId: salaryCat.id,
            amount: 5000,
            description: 'Monthly Salary',
            transactionType: 'income' as const,
            date: new Date(yr, mo, 1),
            originalDate: new Date(yr, mo, 1)
        },
        {
            userId: user.id,
            accountId: chequing.id,
            categoryId: groceriesCat.id,
            amount: 320.50,
            description: 'Weekly Groceries',
            transactionType: 'expense' as const,
            date: new Date(yr, mo, 5),
            originalDate: new Date(yr, mo, 5)
        },
        {
            userId: user.id,
            accountId: chequing.id,
            categoryId: utilitiesCat.id,
            amount: 180,
            description: 'Electricity Bill',
            transactionType: 'expense' as const,
            date: new Date(yr, mo, 8),
            originalDate: new Date(yr, mo, 8)
        },
        {
            userId: user.id,
            accountId: chequing.id,
            categoryId: groceriesCat.id,
            amount: 95.20,
            description: 'Groceries Run',
            transactionType: 'expense' as const,
            date: new Date(yr, mo, 12),
            originalDate: new Date(yr, mo, 12)
        },
        {
            userId: user.id,
            accountId: savings.id,
            categoryId: null,
            amount: 1000,
            description: 'Savings Transfer',
            transactionType: 'transfer' as const,
            date: new Date(yr, mo, 15),
            originalDate: new Date(yr, mo, 15)
        }
    ];

    if (await prisma.transaction.count({where: {userId: user.id}}) === 0) {
        for (const tx of transactions) {
            await prisma.transaction.create({data: tx});
        }
        console.log(`Created ${transactions.length} transactions`);
    } else {
        console.log('Transactions already seeded — skipping.');
    }
    console.log('Seeding complete.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => {
        void prisma.$disconnect();
    });
