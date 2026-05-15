import { prisma } from '../config/database';
import { logger } from '../config/logger';
import crypto from 'crypto';

export class AgencyService {
  async createAgency(ownerId: string, data: {
    name: string;
    slug: string;
    primaryColor?: string;
    commissionPct?: number;
  }) {
    const slugRegex = /^[a-z0-9-]{3,30}$/;
    if (!slugRegex.test(data.slug)) {
      throw new Error('Slug invalide (3-30 chars, lowercase, hyphens only)');
    }

    return prisma.agency.create({
      data: {
        ownerId,
        name: data.name,
        slug: data.slug,
        primaryColor: data.primaryColor ?? '#7B5CF0',
        commissionPct: data.commissionPct ?? 0.20,
      },
    });
  }

  async addClientToAgency(agencyId: string, clientId: string) {
    return prisma.agencyClient.create({
      data: { agencyId, clientId },
    });
  }

  async getAgencyByOwner(ownerId: string) {
    return prisma.agency.findUnique({
      where: { ownerId },
      include: {
        clients: {
          include: {
            client: {
              select: {
                id: true,
                businessName: true,
                subscriptionStatus: true,
                monthlyFee: true,
                createdAt: true,
              },
            },
          },
        },
      },
    });
  }

  async getAgencyStats(agencyId: string) {
    const agency = await prisma.agency.findUniqueOrThrow({
      where: { id: agencyId },
      include: {
        clients: {
          include: {
            client: {
              select: {
                id: true,
                businessName: true,
                subscriptionStatus: true,
                monthlyFee: true,
              },
            },
          },
        },
      },
    });

    const activeClients = agency.clients.filter(ac => ac.client.subscriptionStatus === 'active');
    const totalMrr = activeClients.reduce(
      (sum, ac) => sum + Number(ac.client.monthlyFee ?? 0),
      0
    );
    const commission = totalMrr * agency.commissionPct;

    return {
      agency: { id: agency.id, name: agency.name, slug: agency.slug },
      clientCount: agency.clients.length,
      activeClients: activeClients.length,
      totalMrr,
      commission,
      clients: agency.clients.map(ac => ({
        id: ac.client.id,
        name: ac.client.businessName,
        status: ac.client.subscriptionStatus,
        monthlyFee: Number(ac.client.monthlyFee),
      })),
    };
  }

  async createApiKey(userId: string, name: string, permissions: string[] = ['read']) {
    const key = `qw_${crypto.randomBytes(24).toString('hex')}`;
    return prisma.apiKey.create({
      data: { key, name, userId, permissions },
    });
  }

  async validateApiKey(key: string): Promise<{ userId: string; permissions: string[] } | null> {
    const record = await prisma.apiKey.findUnique({ where: { key } });
    if (!record) return null;
    if (record.expiresAt && record.expiresAt < new Date()) return null;

    // Update lastUsedAt (non-blocking)
    prisma.apiKey.update({ where: { key }, data: { lastUsedAt: new Date() } }).catch(() => {});

    return { userId: record.userId, permissions: record.permissions };
  }

  async listApiKeys(userId: string) {
    return prisma.apiKey.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        permissions: true,
        lastUsedAt: true,
        expiresAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revokeApiKey(id: string, userId: string) {
    return prisma.apiKey.deleteMany({ where: { id, userId } });
  }
}

export const agencyService = new AgencyService();
