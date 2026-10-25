import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  Scope,
  UnauthorizedException,
} from "@nestjs/common";
import { REQUEST } from "@nestjs/core";
import { DATABASE } from "../../infrastructure/database/database.module.js";
import type { Database } from "../../infrastructure/database/client.js";
import type { AuthenticatedRequest } from "../../common/types/auth.types.js";
import type { CreateClientDto, UpdateClientDto } from "../clients/client.dto.js";
import type { PageDto } from "./page.dto.js";

// Request-scoped access: callers cannot supply or override organizationId.
@Injectable({ scope: Scope.REQUEST })
export class TenantDatabaseService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(REQUEST) private readonly request: AuthenticatedRequest,
  ) {}
  private get organizationId() {
    if (!this.request.auth) throw new UnauthorizedException();
    return this.request.auth.organizationId;
  }
  listClients(page: PageDto) {
    return this.db.orm.public.Client.where({
      organizationId: this.organizationId,
    })
      .orderBy((row) => row.id.asc())
      .limit(page.limit)
      .offset(page.offset)
      .all();
  }
  async getClient(id: string) {
    const client = await this.db.orm.public.Client.where({
      organizationId: this.organizationId,
      id,
    }).first();
    if (!client) throw new NotFoundException("Client not found");
    return client;
  }
  createClient(input: CreateClientDto) {
    return this.db.orm.public.Client.create({
      organizationId: this.organizationId,
      name: input.name.trim(),
      email: input.email,
      ...(input.companyName !== undefined ? { companyName: input.companyName } : {}),
      ...(input.taxId !== undefined ? { taxId: input.taxId } : {}),
    });
  }
  async updateClient(id: string, input: UpdateClientDto) {
    // Build a whitelist rather than passing arbitrary objects into the ORM.
    const data = {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.email !== undefined ? { email: input.email } : {}),
      ...(input.companyName !== undefined ? { companyName: input.companyName } : {}),
      ...(input.taxId !== undefined ? { taxId: input.taxId } : {}),
    };
    if (!Object.keys(data).length) return this.getClient(id);
    const client = await this.db.orm.public.Client.where({
      organizationId: this.organizationId,
      id,
    }).update(data);
    if (!client) throw new NotFoundException("Client not found");
    return client;
  }
  async deleteClient(id: string) {
    const organizationId = this.organizationId;
    const client = await this.db.orm.public.Client.where({
      organizationId,
      id,
    }).first();
    if (!client) throw new NotFoundException("Client not found");
    const invoice = await this.db.orm.public.Invoice.where({
      organizationId,
      clientId: id,
    })
      .select("id")
      .first();
    if (invoice)
      throw new ConflictException("This client cannot be deleted because they have invoices.");
    await this.db.orm.public.Client.where({ organizationId, id }).delete();
    return { message: "Client deleted successfully." };
  }
  listExpenses(page: PageDto) {
    return this.db.orm.public.Expense.where({
      organizationId: this.organizationId,
    })
      .orderBy((row) => row.id.asc())
      .limit(page.limit)
      .offset(page.offset)
      .all();
  }
  listRetainers(page: PageDto) {
    return this.db.orm.public.Retainer.where({
      organizationId: this.organizationId,
    })
      .orderBy((row) => row.id.asc())
      .limit(page.limit)
      .offset(page.offset)
      .all();
  }
  async listMembers(page: PageDto) {
    const memberships = await this.db.orm.public.Membership.where({
      organizationId: this.organizationId,
    })
      .select("id", "role", "userId")
      .orderBy((row) => row.id.asc())
      .limit(page.limit)
      .offset(page.offset)
      .all();
    return Promise.all(
      memberships.map(async (membership) => ({
        ...membership,
        user: await this.db.orm.public.User.where({
          organizationId: this.organizationId,
          id: membership.userId,
        })
          .select("id", "email", "fullName", "avatarUrl")
          .first(),
      })),
    );
  }
}
