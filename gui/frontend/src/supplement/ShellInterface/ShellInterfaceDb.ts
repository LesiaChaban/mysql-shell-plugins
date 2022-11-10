/*
 * Copyright (c) 2022, Oracle and/or its affiliates.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License, version 2.0,
 * as published by the Free Software Foundation.
 *
 * This program is also distributed with certain software (including
 * but not limited to OpenSSL) that is licensed under separate terms, as
 * designated in a particular file or component or in included license
 * documentation.  The authors of MySQL hereby grant you an additional
 * permission to link the program and your derivative works with the
 * separately licensed software that they have included with MySQL.
 * This program is distributed in the hope that it will be useful,  but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
 * the GNU General Public License, version 2.0, for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software Foundation, Inc.,
 * 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA
 */

import { MessageScheduler, ShellAPIGui, IShellDbConnection } from "../../communication";
import { webSession } from "../WebSession";

export type RoutineType = "function" | "procedure";

/**
 * This interface serves as utility for DB related work (DB object retrieval and so on).
 * It cannot execute SQL, though. Use the SQL editor interface for that.
 */
export class ShellInterfaceDb {

    protected moduleSessionLookupId = "";

    /**
     * Starts a simple DB session for certain DB object related work.
     *
     * @param id A unique ID to identify this session.
     * @param connection Either the ID of a stored DB editor connection or a set of credentials for an ad hoc
     *                   connection.
     *
     * @returns A promise which resolves when the operation was concluded.
     */
    public async startSession(id: string, connection: number | IShellDbConnection): Promise<void> {
        this.moduleSessionLookupId = `dbSession.${id}`;

        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIGui.GuiDbStartSession,
            parameters: { args: { connection } },
        });

        webSession.setModuleSessionId(this.moduleSessionLookupId, response.result.moduleSessionId);
    }

    /**
     * Closes this session and all open connections.
     *
     * @returns A promise which resolves when the operation was concluded.
     */
    public async closeSession(): Promise<void> {
        if (!this.moduleSessionId) {
            return;
        }

        await MessageScheduler.get.sendRequest({
            requestType: ShellAPIGui.GuiDbCloseSession,
            parameters: { args: { moduleSessionId: this.moduleSessionId } },
        });
        webSession.setModuleSessionId(this.moduleSessionLookupId);
    }

    /**
     * Returns the list of available catalog objects (schemas, engines, variables and so on).
     *
     * @param type Which type of object to retrieve.
     * @param filter A search filter.
     *
     * @returns A promise which resolves when the operation was concluded.
     */
    public async getCatalogObjects(type: string, filter?: string): Promise<string[]> {
        if (!this.moduleSessionId) {
            return [];
        }

        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIGui.GuiDbGetCatalogObjectNames,
            parameters: { args: { type, filter, moduleSessionId: this.moduleSessionId } },
        });

        return response.result;
    }

    /**
     * Returns a list of schema object names (tables, views etc.).
     *
     * @param schema The schema for which to retrieve the names.
     * @param type Which type of object to retrieve.
     * @param routineType Valid only for routines.
     * @param filter A search filter.
     *
     * @returns A promise which resolves when the operation was concluded.
     */
    public async getSchemaObjects(schema: string, type: string, routineType?: RoutineType,
        filter?: string): Promise<string[]> {
        if (!this.moduleSessionId) {
            return [];
        }

        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIGui.GuiDbGetSchemaObjectNames,
            parameters: {
                args: {
                    type,
                    filter,
                    schemaName: schema,
                    routineType,
                    moduleSessionId: this.moduleSessionId,
                },
            },
        });

        const result: string[] = [];
        response.forEach((entry) => {
            result.push(...entry.result);
        });

        return result;
    }

    /**
     * Returns a list of table objects (columns, indexes and so on).
     *
     * @param schema The schema for which to retrieve the names.
     * @param table The table for which to retrieve the names.
     * @param type Which type of object to retrieve.
     * @param filter A search filter.
     *
     * @returns A promise which resolves when the operation was concluded.
     */
    public async getTableObjects(schema: string, table: string, type: string, filter?: string): Promise<string[]> {
        if (!this.moduleSessionId) {
            return [];
        }

        const response = await MessageScheduler.get.sendRequest({
            requestType: ShellAPIGui.GuiDbGetTableObjectNames,
            parameters: {
                args: {
                    type,
                    filter,
                    schemaName: schema,
                    tableName: table,
                    moduleSessionId: this.moduleSessionId,
                },
            },
        });

        return response.result;
    }

    protected get moduleSessionId(): string | undefined {
        return webSession.moduleSessionId(this.moduleSessionLookupId);
    }

}
