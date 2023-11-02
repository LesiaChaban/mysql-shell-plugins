/*
 * Copyright (c) 2022, 2023, Oracle and/or its affiliates.
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
import { until, Condition } from "vscode-extension-tester";
import { driver } from "./misc";
import * as locator from "./locators";

export class Shell {

    public static isShellLoaded = (): Condition<boolean> => {
        return new Condition("Shell is not loaded",
            async () => {
                const title = await driver.findElements(locator.shellConsole.title);
                const textarea = await driver.findElements(locator.notebook.codeEditor.textArea);

                return title.length > 0 || textarea.length > 0;
            });
    };

    public static changeSchemaOnTab = async (schema: string): Promise<void> => {
        const tabSchema = await driver.findElement(locator.shellConsole.connectionTab.schema);
        await tabSchema.click();
        const menu = await driver.wait(until.elementLocated(locator.shellConsole.connectionTab.schemaMenu),
            3000, "Schema list was not displayed");
        const items = await menu.findElements(locator.shellConsole.connectionTab.schemaItem);
        for (const item of items) {
            if ((await item.getAttribute("innerHTML")).includes(schema)) {
                await item.click();
                break;
            }
        }

        await driver.wait(async () => {
            return (await driver.findElement(locator.shellConsole.connectionTab.schema).getText()).includes(schema);
        }, 3000, `${schema} was not selected`);
    };
}
