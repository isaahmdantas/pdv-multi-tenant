import type { PrismaClient } from "@/generated/prisma/client";
import type { TenantContext } from "@/modules/tenant/domain/tenant-context";
import type {
  CreateUnitConversionInput,
  CreateUnitMeasureInput,
  UpdateUnitMeasureInput,
} from "@/modules/products/schemas";
import { toDecimal } from "@/modules/products/schemas";
import { UnitMeasureRepository } from "@/modules/products/repositories/catalog-repository";
import { AuditService } from "@/modules/audit/services/audit-service";
import { notFound, conflict, badRequest } from "@/lib/api/errors";

type CreateUnitData = Omit<CreateUnitMeasureInput, "code"> & { code: string };

export class UnitMeasureService {
  constructor(private readonly prisma: PrismaClient) {}

  async list(ctx: TenantContext) {
    const repo = new UnitMeasureRepository(this.prisma, ctx);
    const rows = await repo.list();
    return rows.map((u) => ({
      id: u.id,
      code: u.code,
      name: u.name,
      status: u.status,
      conversions: u.conversionsFrom.map((c) => ({
        id: c.id,
        fromUnitId: c.fromUnitId,
        toUnitId: c.toUnitId,
        factor: c.factor,
        toUnit: c.toUnit,
      })),
    }));
  }

  async get(ctx: TenantContext, id: string) {
    const repo = new UnitMeasureRepository(this.prisma, ctx);
    const row = await repo.findById(id);
    if (!row) throw notFound("Unidade de medida não encontrada", "UNIT_MEASURE_NOT_FOUND");
    return row;
  }

  async create(ctx: TenantContext, input: CreateUnitData, meta?: { ip?: string; device?: string }) {
    const repo = new UnitMeasureRepository(this.prisma, ctx);
    if (await repo.findByCode(input.code)) {
      throw conflict("Já existe uma unidade com este código", "UNIT_MEASURE_TAKEN");
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const unit = await tx.unitOfMeasure.create({
        data: { tenantId: ctx.tenantId, code: input.code, name: input.name },
        select: { id: true, code: true, name: true },
      });
      await new AuditService(tx).log({
        ctx,
        action: "UNIT_MEASURE_CREATED",
        entity: "UnitOfMeasure",
        entityId: unit.id,
        after: { code: unit.code, name: unit.name },
        ip: meta?.ip,
        device: meta?.device,
      });
      return unit;
    });

    return created;
  }

  async update(
    ctx: TenantContext,
    id: string,
    input: UpdateUnitMeasureInput,
    meta?: { ip?: string; device?: string },
  ) {
    const repo = new UnitMeasureRepository(this.prisma, ctx);
    const existing = await repo.findById(id);
    if (!existing) throw notFound("Unidade de medida não encontrada", "UNIT_MEASURE_NOT_FOUND");

    if (input.code && input.code !== existing.code) {
      const taken = await repo.findByCode(input.code);
      if (taken) throw conflict("Já existe uma unidade com este código", "UNIT_MEASURE_TAKEN");
    }

    const data: Record<string, unknown> = {};
    if (input.code !== undefined) data.code = input.code;
    if (input.name !== undefined) data.name = input.name;

    const updated = await this.prisma.$transaction(async (tx) => {
      const unit = await tx.unitOfMeasure.update({
        where: { id },
        data,
        select: { id: true, code: true, name: true },
      });
      await new AuditService(tx).log({
        ctx,
        action: "UNIT_MEASURE_UPDATED",
        entity: "UnitOfMeasure",
        entityId: id,
        before: { code: existing.code, name: existing.name },
        after: { code: unit.code, name: unit.name },
        ip: meta?.ip,
        device: meta?.device,
      });
      return unit;
    });

    return updated;
  }

  async deactivate(ctx: TenantContext, id: string, meta?: { ip?: string; device?: string }) {
    const repo = new UnitMeasureRepository(this.prisma, ctx);
    const existing = await repo.findById(id);
    if (!existing) throw notFound("Unidade de medida não encontrada", "UNIT_MEASURE_NOT_FOUND");

    const updated = await this.prisma.$transaction(async (tx) => {
      const unit = await tx.unitOfMeasure.update({
        where: { id },
        data: { status: "INACTIVE" },
        select: { id: true, code: true, name: true },
      });
      await new AuditService(tx).log({
        ctx,
        action: "UNIT_MEASURE_DEACTIVATED",
        entity: "UnitOfMeasure",
        entityId: id,
        before: { status: existing.status },
        after: { status: "INACTIVE" },
        ip: meta?.ip,
        device: meta?.device,
      });
      return unit;
    });

    return updated;
  }

  async addConversion(
    ctx: TenantContext,
    fromUnitId: string,
    input: CreateUnitConversionInput,
    meta?: { ip?: string; device?: string },
  ) {
    const repo = new UnitMeasureRepository(this.prisma, ctx);

    const from = await repo.findById(fromUnitId);
    if (!from) throw notFound("Unidade de medida não encontrada", "UNIT_MEASURE_NOT_FOUND");

    if (fromUnitId === input.toUnitId) {
      throw badRequest("Não é possível converter uma unidade para ela mesma", "INVALID_CONVERSION");
    }

    const to = await this.prisma.unitOfMeasure.findFirst({
      where: { tenantId: ctx.tenantId, id: input.toUnitId, status: "ACTIVE" },
    });
    if (!to) throw badRequest("Unidade de destino inválida", "INVALID_TARGET_UNIT");

    if (await repo.findConversion(fromUnitId, input.toUnitId)) {
      throw conflict("Esta conversão já existe", "UNIT_CONVERSION_EXISTS");
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const conversion = await tx.unitConversion.create({
        data: {
          tenantId: ctx.tenantId,
          fromUnitId,
          toUnitId: input.toUnitId,
          factor: toDecimal(input.factor),
        },
        select: { id: true, fromUnitId: true, toUnitId: true, factor: true },
      });
      await new AuditService(tx).log({
        ctx,
        action: "UNIT_CONVERSION_CREATED",
        entity: "UnitConversion",
        entityId: conversion.id,
        before: { fromUnitId, toUnitId: input.toUnitId },
        after: { fromUnitId, toUnitId: input.toUnitId, factor: conversion.factor },
        ip: meta?.ip,
        device: meta?.device,
      });
      return conversion;
    });

    return created;
  }

  async removeConversion(
    ctx: TenantContext,
    fromUnitId: string,
    toUnitId: string,
    meta?: { ip?: string; device?: string },
  ) {
    const repo = new UnitMeasureRepository(this.prisma, ctx);
    const existing = await repo.findConversion(fromUnitId, toUnitId);
    if (!existing) throw notFound("Conversão não encontrada", "UNIT_CONVERSION_NOT_FOUND");

    const removed = await this.prisma.$transaction(async (tx) => {
      await tx.unitConversion.delete({ where: { id: existing.id } });
      await new AuditService(tx).log({
        ctx,
        action: "UNIT_CONVERSION_DELETED",
        entity: "UnitConversion",
        entityId: existing.id,
        before: { fromUnitId, toUnitId, factor: existing.factor },
        ip: meta?.ip,
        device: meta?.device,
      });
    });

    return removed;
  }
}