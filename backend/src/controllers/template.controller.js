import prisma from '../config/prisma.js';
import { AppError } from '../utils/AppError.js';
import { parseId, parsePagination, pageResult } from '../utils/http.js';
import { prepareTemplateLines } from '../services/templateLines.js';

const templateInclude = {
  lines: {
    include: {
      product: { select: { id: true, name: true } },
      plan: { select: { id: true, name: true, billingFrequency: true } },
      variantOption: { select: { id: true, value: true, extraPrice: true } },
      tax: { select: { id: true, name: true, rateBps: true } },
    },
    orderBy: { id: 'asc' },
  },
};

export async function listTemplates(req, res) {
  const pagination = parsePagination(req.query);
  const { search, active } = req.query;

  const where = {};
  if (search) where.name = { contains: String(search), mode: 'insensitive' };
  if (active === 'true') where.isActive = true;

  const [templates, total] = await Promise.all([
    prisma.quotationTemplate.findMany({
      where,
      include: { _count: { select: { lines: true } } },
      orderBy: { createdAt: 'desc' },
      skip: pagination.skip,
      take: pagination.limit,
    }),
    prisma.quotationTemplate.count({ where }),
  ]);

  res.json(pageResult(templates, total, pagination));
}

export async function getTemplate(req, res) {
  const template = await prisma.quotationTemplate.findUnique({
    where: { id: parseId(req.params.id) },
    include: templateInclude,
  });
  if (!template) throw new AppError('Template not found', 404);
  res.json({ template });
}

export async function createTemplate(req, res) {
  const { lines, ...data } = req.body;
  const prepared = await prepareTemplateLines(lines);

  const template = await prisma.quotationTemplate.create({
    data: { ...data, lines: { create: prepared } },
    include: templateInclude,
  });
  res.status(201).json({ template });
}

export async function updateTemplate(req, res) {
  const id = parseId(req.params.id);
  const existing = await prisma.quotationTemplate.findUnique({ where: { id } });
  if (!existing) throw new AppError('Template not found', 404);

  const { lines, ...data } = req.body;
  const updateData = { ...data };
  if (lines) {
    updateData.lines = { deleteMany: {}, create: await prepareTemplateLines(lines) };
  }

  const template = await prisma.quotationTemplate.update({
    where: { id },
    data: updateData,
    include: templateInclude,
  });
  res.json({ template });
}

export async function deleteTemplate(req, res) {
  const id = parseId(req.params.id);
  const existing = await prisma.quotationTemplate.findUnique({ where: { id } });
  if (!existing) throw new AppError('Template not found', 404);

  // Subscriptions created from it keep working (their template link is simply cleared)
  await prisma.quotationTemplate.delete({ where: { id } });
  res.json({ message: 'Template deleted' });
}