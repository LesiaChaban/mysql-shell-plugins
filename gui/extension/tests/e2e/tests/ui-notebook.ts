/*
 * Copyright (c) 2023 Oracle and/or its affiliates.
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
import fs from "fs/promises";
import { expect } from "chai";
import {
    ActivityBar, Condition, CustomTreeSection, EditorView, InputBox, Key, TreeItem,
    until, WebElement, ModalDialog, error,
} from "vscode-extension-tester";
import { browser, driver, Misc } from "../lib/misc";
import { Database } from "../lib/db";
import * as constants from "../lib/constants";
import * as Until from "../lib/until";
import * as interfaces from "../lib/interfaces";
import * as locator from "../lib/locators";
import { CommandExecutor } from "../lib/cmdExecutor";

describe("NOTEBOOKS", () => {

    if (!process.env.DBHOSTNAME) {
        throw new Error("Please define the environment variable DBHOSTNAME");
    }
    if (!process.env.DBUSERNAME) {
        throw new Error("Please define the environment variable DBUSERNAME");
    }
    if (!process.env.DBPASSWORD) {
        throw new Error("Please define the environment variable DBPASSWORD");
    }
    if (!process.env.DBSHELLUSERNAME) {
        throw new Error("Please define the environment variable DBSHELLUSERNAME");
    }
    if (!process.env.DBSHELLPASSWORD) {
        throw new Error("Please define the environment variable DBSHELLPASSWORD");
    }
    if (!process.env.DBPORT) {
        throw new Error("Please define the environment variable DBPORT");
    }
    if (!process.env.DBPORTX) {
        throw new Error("Please define the environment variable DBPORTX");
    }
    if (!process.env.SSL_ROOT_FOLDER) {
        throw new Error("Please define the environment variable SSL_ROOT_FOLDER");
    }

    const globalConn: interfaces.IDBConnection = {
        dbType: "MySQL",
        caption: "globalDBConnection",
        description: "Local connection",
        basic: {
            hostname: String(process.env.DBHOSTNAME),
            username: String(process.env.DBUSERNAME),
            port: Number(process.env.DBPORT),
            portX: Number(process.env.DBPORTX),
            schema: "sakila",
            password: String(process.env.DBPASSWORD),
        },
    };

    before(async function () {

        await Misc.loadDriver();

        try {
            await driver.wait(Until.extensionIsReady(), constants.wait2minutes);
            await Misc.toggleBottomBar(false);
            await Database.createConnection(globalConn);
            await new EditorView().closeAllEditors();
            expect(await Misc.existsTreeElement(constants.dbTreeSection, globalConn.caption)).to.be.true;
            await Misc.cleanCredentials();
            await Misc.sectionFocus(constants.dbTreeSection);
            if (await Misc.requiresMRSMetadataUpgrade(globalConn)) {
                await Misc.upgradeMRSMetadata();
            }
        } catch (e) {
            await Misc.processFailure(this);
            throw e;
        }
    });

    after(async function () {
        try {
            const dbConnections = await Misc.getDBConnections();
            for (const dbConnection of dbConnections) {
                await Misc.deleteConnection(dbConnection.name, dbConnection.isMySQL, false);
            }
        } catch (e) {
            await Misc.processFailure(this);
            throw e;
        }
    });

    describe("DB Editor", () => {

        let clean = false;
        let result: interfaces.ICommandResult;
        let lastResultId = "";

        const updateResultId = (value) => {
            lastResultId = value;
        };

        before(async function () {
            try {
                await Misc.cleanCredentials();
                await Misc.openContextMenuItem(await Misc.getTreeElement(constants.dbTreeSection, globalConn.caption),
                    constants.openNewConnection, constants.checkNewTabAndWebView);
                await driver.wait(Until.dbConnectionIsOpened(globalConn), constants.wait15seconds);
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }
        });

        beforeEach(() => {
            clean = false;
        });

        afterEach(async function () {
            if (this.currentTest.state === "failed") {
                await Misc.processFailure(this);
            }

            if (clean) {
                await Misc.cleanEditor();
            }
        });

        after(async function () {
            try {
                await Misc.switchBackToTopFrame();
                const treeGlobalConn = await Misc.getTreeElement(constants.dbTreeSection, globalConn.caption);
                await treeGlobalConn.collapse();
                await new EditorView().closeAllEditors();
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }
        });

        it("Multi-cursor", async () => {
            try {

                await CommandExecutor.write("select * from sakila.actor;");
                await Database.setNewLineOnEditor();
                await CommandExecutor.write("select * from sakila.address;");
                await Database.setNewLineOnEditor();
                await CommandExecutor.write("select * from sakila.city;");

                const clickLine = async (line: number): Promise<void> => {
                    await driver.wait(async () => {
                        try {
                            const lines = await driver.findElements(locator.notebook.codeEditor.editor.line);
                            lines.shift();
                            await lines[line].click();

                            return true;
                        } catch (e) {
                            if (!(e instanceof error.StaleElementReferenceError)) {
                                throw e;
                            }
                        }
                    }, constants.wait5seconds, `Line ${line} was stale, could not click on it`);
                };


                await driver.actions().keyDown(Key.ALT).perform();
                await clickLine(0);
                await clickLine(1);
                await driver.actions().keyUp(Key.ALT).perform();
                const area = await driver.findElement(locator.notebook.codeEditor.textArea);
                await area.sendKeys(Key.BACK_SPACE);
                await driver.sleep(200);
                await area.sendKeys(Key.BACK_SPACE);
                await driver.sleep(200);
                await area.sendKeys(Key.BACK_SPACE);

                const textArea = await driver.findElement(locator.notebook.codeEditor.textArea);
                let items = (await textArea.getAttribute("value")).split("\n");
                items.shift();
                expect(items[0].length).equals(24);
                expect(items[1].length).equals(26);
                expect(items[2].length).equals(23);

                await textArea.sendKeys("testing");

                items = (await textArea.getAttribute("value")).split("\n");
                items.shift();
                expect(items[0]).to.include("testing");
                expect(items[1]).to.include("testing");
                expect(items[2]).to.include("testing");
            } finally {
                clean = true;
            }
        });

        it("Using a DELIMITER", async () => {

            try {
                const query =
                    `DELIMITER $$
                    SELECT actor_id
                    FROM
                    sakila.actor LIMIT 1 $$


                    select 1 $$
                `;

                result = await CommandExecutor.executeWithButton(query, undefined, constants.execFullBlockSql);
                updateResultId(result.id);
                expect(result.message).to.match(/OK/);
                const content = (result.content as unknown as interfaces.ICommandTabResult[]);
                expect(content.length).to.equals(2);
                for (const result of content) {
                    expect(result.tabName).to.match(/Result/);
                }
            } finally {
                clean = true;
            }
        });

        it("Connection toolbar buttons - Execute selection or full block and create a new block", async () => {

            const prompts = await Database.getPrompts();
            result = await CommandExecutor.executeWithButton("SELECT * FROM sakila.actor;", undefined,
                constants.execFullBlockSql);
            updateResultId(result.id);
            expect(result.message).to.match(/(\d+) record/);
            await driver.wait(async () => {
                return (await Database.getPrompts()) > prompts;
            }, constants.wait5seconds, "A new prompt line should exist");
        });

        it("Connection toolbar buttons - Execute statement at the caret position", async () => {

            try {
                const query1 = "select * from sakila.actor limit 1;";
                const query2 = "select * from sakila.address limit 2;";
                await CommandExecutor.write(query1, true);
                await Database.setNewLineOnEditor();
                await CommandExecutor.write(query2, true);
                let result = await CommandExecutor.findCmdAndExecute(query1, lastResultId);
                updateResultId(result.id);
                expect(result.message).to.match(/OK/);
                expect(await (result.content as WebElement).getAttribute("innerHTML")).to.match(/actor_id/);
                result = await CommandExecutor.findCmdAndExecute(query2, undefined, lastResultId);
                updateResultId(result.id);
                expect(await (result.content as WebElement).getAttribute("innerHTML")).to.match(/address_id/);
            } finally {
                clean = true;
            }
        });

        it("Switch between search tabs", async () => {

            result = await CommandExecutor
                .execute("select * from sakila.actor limit 1; select * from sakila.address limit 1;", undefined, true);
            updateResultId(result.id);
            expect(result.message).to.match(/OK/);
            const resultTabs = (result.content as unknown as interfaces.ICommandTabResult[]);
            expect(resultTabs[0].tabName).to.equals("Result #1");
            expect(resultTabs[1].tabName).to.equals("Result #2");
            expect(resultTabs[0].content).to.match(/actor_id.*first_name.*last_name.*last_update/);
            expect(resultTabs[1].content)
                .to.match(/address.*address2.*district.*city_id.*postal_code.*phone.*last_update/);
        });

        it("Connect to database and verify default schema", async () => {

            result = await CommandExecutor.execute("SELECT SCHEMA();", lastResultId);
            updateResultId(result.id);
            expect(result.message).to.match(/1 record retrieved/);
            expect(await ((result.content as WebElement)
                .findElement(locator.notebook.codeEditor.editor.result.tableCell)).getText())
                .to.equals((globalConn.basic as interfaces.IConnBasicMySQL).schema);
        });

        it("Connection toolbar buttons - Autocommit DB Changes", async () => {

            const autoCommitBtn = await Database.getToolbarButton(constants.autoCommit);
            const style = await autoCommitBtn.findElement(locator.notebook.toolbar.button.icon).getAttribute("style");
            if (style.includes("toolbar-auto_commit-active")) {
                await autoCommitBtn.click();
            }
            const random = (Math.random() * (10.00 - 1.00 + 1.00) + 1.00).toFixed(5);
            const commitBtn = await Database.getToolbarButton(constants.commit);
            const rollBackBtn = await Database.getToolbarButton(constants.rollback);

            await driver.wait(until.elementIsEnabled(commitBtn),
                3000, "Commit button should be enabled");

            await driver.wait(until.elementIsEnabled(rollBackBtn),
                3000, "Commit button should be enabled");

            let result = await CommandExecutor
                .execute(`INSERT INTO sakila.actor (first_name, last_name) VALUES ("${random}","${random}");`,
                    lastResultId);
            updateResultId(result.id);
            expect(result.message).to.match(/OK/);

            await rollBackBtn.click();

            result = await CommandExecutor.execute(`SELECT * FROM sakila.actor WHERE first_name="${random}";`,
                lastResultId);
            updateResultId(result.id);
            expect(result.message).to.match(/OK/);

            result = await CommandExecutor
                .execute(`INSERT INTO sakila.actor (first_name, last_name) VALUES ("${random}","${random}");`,
                    lastResultId);
            updateResultId(result.id);
            expect(result.message).to.match(/OK/);

            await commitBtn.click();

            result = await CommandExecutor.execute(`SELECT * FROM sakila.actor WHERE first_name="${random}";`,
                lastResultId);
            updateResultId(result.id);
            expect(result.message).to.match(/OK/);

            await autoCommitBtn.click();

            await driver.wait(
                async () => {
                    const commitBtn = await Database.getToolbarButton(constants.commit);
                    const rollBackBtn = await Database.getToolbarButton(constants.rollback);

                    return (await commitBtn?.getAttribute("class"))?.includes("disabled") &&
                        (await rollBackBtn?.getAttribute("class"))?.includes("disabled");

                },
                constants.wait5seconds,
                "Commit/Rollback DB changes button is still enabled ",
            );

            result = await CommandExecutor.execute(`DELETE FROM sakila.actor WHERE first_name="${random}";`,
                lastResultId);
            updateResultId(result.id);
            expect(result.message).to.match(/OK/);
        });

        it("Connection toolbar buttons - Find and Replace", async () => {

            try {
                const contentHost = await driver.findElement(locator.notebook.exists);
                await CommandExecutor.write(`import from xpto xpto xpto`);
                const findBtn = await Database.getToolbarButton("Find");
                await findBtn.click();
                const finder = await driver.wait(until.elementLocated(locator.findWidget.exists),
                    constants.wait5seconds, "Find widget was not displayed");
                expect(await finder.getAttribute("aria-hidden")).equals("false");
                await finder.findElement(locator.notebook.codeEditor.textArea).sendKeys("xpto");
                await Database.findInSelection(false);
                expect(
                    await finder.findElement(locator.findWidget.matchesCount).getText(),
                ).to.match(/1 of (\d+)/);
                await driver.wait(
                    until.elementsLocated(locator.findWidget.findMatch),
                    2000,
                    "No words found",
                );
                await Database.toggleFinderReplace(true);
                const replacer = await finder.findElement(locator.findWidget.replacePart);
                await replacer.findElement(locator.notebook.codeEditor.textArea).sendKeys("tester");
                await (await Database.replacerGetButton("Replace (Enter)")).click();
                expect(
                    await contentHost.findElement(locator.notebook.codeEditor.textArea).getAttribute("value"),
                ).to.include("import from tester xpto xpto");

                await replacer.findElement(locator.notebook.codeEditor.textArea).clear();
                await replacer.findElement(locator.notebook.codeEditor.textArea).sendKeys("testing");
                await (await Database.replacerGetButton("Replace All")).click();
                expect(
                    await contentHost.findElement(locator.notebook.codeEditor.textArea).getAttribute("value"),
                ).to.include("import from tester testing testing");
                await Database.closeFinder();
                expect(await finder.getAttribute("aria-hidden")).equals("true");

            } finally {
                clean = true;
            }

        });

        it("Execute code on different prompt languages", async () => {
            try {
                const query = "select * from sakila.actor limit 1";
                const languageSwitch = "\\javascript ";
                const jsCmd = "Math.random()";

                let result = await CommandExecutor.execute(query);
                const block1 = result.id;
                expect(result.message).to.match(/OK/);
                await CommandExecutor.languageSwitch(languageSwitch);
                result = await CommandExecutor.execute(jsCmd, block1);
                const block2 = result.id;
                expect(result.message).to.match(/(\d+).(\d+)/);
                result = await CommandExecutor.findCmdAndExecute(query, undefined, block1);
                expect(result.message).to.match(/OK/);
                result = await CommandExecutor.findCmdAndExecute(jsCmd, undefined, block2);
                expect(result.message).to.match(/(\d+).(\d+)/);

            } finally {
                clean = true;
            }
        });

        it("Multi-line comments", async () => {

            await CommandExecutor.languageSwitch("\\sql ", undefined, true);
            result = await CommandExecutor.execute("select version();");
            updateResultId(result.id);
            expect(result.message).to.match(/1 record retrieved/);
            const txt = await (result.content as WebElement)
                .findElement(locator.notebook.codeEditor.editor.result.tableCell).getText();
            const server = txt.match(/(\d+).(\d+).(\d+)/g)![0];
            const digits = server.split(".");
            let serverVer = digits[0];
            digits[1].length === 1 ? serverVer += "0" + digits[1] : serverVer += digits[1];
            digits[2].length === 1 ? serverVer += "0" + digits[2] : serverVer += digits[2];
            result = await CommandExecutor.execute(`/*!${serverVer} select * from sakila.actor;*/`, lastResultId, true);
            updateResultId(result.id);
            expect(result.message).to.match(/OK, (\d+) records retrieved/);
            const higherServer = parseInt(serverVer, 10) + 1;
            result = await CommandExecutor.execute(`/*!${higherServer} select * from sakila.actor;*/`,
                lastResultId, true);
            updateResultId(result.id);
            expect(result.message).to.match(/OK, 0 records retrieved/);

        });

        it("Context Menu - Execute", async () => {

            let prompts = await Database.getPrompts();
            let result = await CommandExecutor.executeWithContextMenu("select * from sakila.actor limit 1;",
                lastResultId,
                constants.executeBlock);
            updateResultId(result.id);
            expect(result.message).to.match(/OK, 1 record retrieved/);
            expect(await Database.getPrompts()).to.equal(prompts);
            await Misc.cleanEditor();

            prompts = await Database.getPrompts();
            result = await CommandExecutor
                .executeWithContextMenu("select * from sakila.actor limit 1;", undefined,
                    constants.executeBlockAndAdvance);
            updateResultId(result.id);
            expect(result.message).to.match(/OK, 1 record retrieved/);
            expect(await Database.getPrompts()).to.be.greaterThan(prompts);

        });

        it("Maximize and Normalize Result tab", async () => {

            result = await CommandExecutor.execute("select * from sakila.actor;", lastResultId);
            lastResultId = result.id;
            expect(result.message).to.match(/OK/);
            await result.toolbar.findElement(locator.notebook.codeEditor.editor.result.status.maximize).click();
            await driver.wait(new Condition("", async () => {
                return Database.isResultTabMaximized();
            }), constants.wait5seconds, "Result tab was not maxized");

            expect(await Database.getCurrentEditor()).to.equals("Result #1");
            try {
                expect(await Database.isEditorStretched()).to.be.false;
                let tabArea = await driver.findElements(locator.notebook.codeEditor.editor.result.tabSection.body);
                expect(tabArea.length, "Result tab should not be visible").to.equals(0);
                await driver.findElement(locator.notebook.codeEditor.editor.result.status.normalize).click();
                expect(await Database.isEditorStretched()).to.be.true;
                expect(await Database.isResultTabMaximized()).to.be.false;
                tabArea = await driver.findElements(locator.notebook.codeEditor.editor.result.tabSection.body);
                expect(tabArea.length, "Result tab should be visible").to.equals(1);
            } finally {
                await Database.selectCurrentEditor("DB Notebook", "notebook");
            }
        });

        it("Pie Graph based on DB table", async () => {

            await CommandExecutor.languageSwitch("\\ts ", undefined, true);
            result = await CommandExecutor.execute(
                `const res = await runSql("SELECT Name, Capital FROM world_x_cst.country limit 10");
                const options: IGraphOptions = {
                    series: [
                        {
                            type: "bar",
                            yLabel: "Actors",
                            data: res as IJsonGraphData,
                        }
                    ]
                };
                Graph.render(options);
                `);

            expect(result.message).to.match(/graph/);
            const pieChart = result.content;
            const chartColumns = await (pieChart as WebElement)
                .findElements(locator.notebook.codeEditor.editor.result.graphHost.column);
            for (const col of chartColumns) {
                expect(parseInt(await col.getAttribute("width"), 10)).to.be.greaterThan(0);
            }

        });

        it("Schema autocomplete context menu", async () => {

            await CommandExecutor.languageSwitch("\\sql ", undefined, true);
            await CommandExecutor.write("select * from");
            await driver.findElement(locator.notebook.codeEditor.textArea).sendKeys(Key.SPACE);
            await CommandExecutor.openSuggestionMenu();
            const els = await Database.getAutoCompleteMenuItems();
            expect(els).to.include("mysql");
            expect(els).to.include("performance_schema");
            expect(els).to.include("sakila");
            expect(els).to.include("sys");
            expect(els).to.include("world_x_cst");

        });

    });

    describe("Scripts", () => {

        let refItem: TreeItem;

        before(async function () {
            try {
                await Misc.cleanCredentials();
                await Misc.sectionFocus(constants.dbTreeSection);
                const treeGlobalConn = await Misc.getTreeElement(constants.dbTreeSection, globalConn.caption);
                await (await Misc.getActionButton(treeGlobalConn, constants.openNewConnection)).click();
                await driver.wait(Until.dbConnectionIsOpened(globalConn), constants.wait15seconds);
                await Misc.switchBackToTopFrame();
                await Misc.sectionFocus(constants.openEditorsTreeSection);
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }
        });

        afterEach(async function () {
            if (this.currentTest.state === "failed") {
                await Misc.processFailure(this);
            }

            await (await Misc.getActionButton(refItem, "Close Editor")).click();
        });

        after(async function () {
            try {
                await Misc.switchBackToTopFrame();
                await Misc.sectionFocus(constants.dbTreeSection);
                const treeGlobalConn = await Misc.getTreeElement(constants.dbTreeSection, globalConn.caption);
                await treeGlobalConn.collapse();
                await new EditorView().closeAllEditors();
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }

        });

        it("Add SQL Script", async () => {

            const treeGlobalConn = await Misc.getTreeElement(constants.openEditorsTreeSection, globalConn.caption);
            await Misc.openContextMenuItem(treeGlobalConn, constants.newMySQLScript, constants.checkNewTabAndWebView);
            await driver.wait(async () => {
                return (await Database.getCurrentEditor()).match(/Untitled-(\d+)/);
            }, constants.wait5seconds, "Current editor is not Untitled-(*)");
            expect(await Database.getCurrentEditorType()).to.include("Mysql");
            const result = await Database.execScript("select * from sakila.actor limit 1;");
            expect(result).to.match(/OK, (\d+) record/);
            await Misc.switchBackToTopFrame();
            const treeOpenEditorsSection = await Misc.getSection(constants.openEditorsTreeSection);
            refItem = await Misc.getTreeScript(treeOpenEditorsSection, "Untitled-", "Mysql");
            expect(refItem).to.exist;
        });

        it("Add Typescript", async () => {
            const treeGlobalConn = await Misc.getTreeElement(constants.openEditorsTreeSection, globalConn.caption);
            await Misc.openContextMenuItem(treeGlobalConn, constants.newTS, constants.checkNewTabAndWebView);
            await driver.wait(async () => {
                return (await Database.getCurrentEditor()).match(/Untitled-(\d+)/);
            }, constants.wait5seconds, "Current editor is not Untitled-(*)");
            expect(await Database.getCurrentEditorType()).to.include("scriptTs");
            const result = await Database.execScript("Math.random()");
            expect(result).to.match(/(\d+).(\d+)/);
            await Misc.switchBackToTopFrame();
            const treeOpenEditorsSection = await Misc.getSection(constants.openEditorsTreeSection);
            refItem = await Misc.getTreeScript(treeOpenEditorsSection, "Untitled-", "scriptTs");
            expect(refItem).to.exist;
        });

        it("Add Javascript", async () => {

            const treeGlobalConn = await Misc.getTreeElement(constants.openEditorsTreeSection, globalConn.caption);
            await Misc.openContextMenuItem(treeGlobalConn, constants.newJS, constants.checkNewTabAndWebView);
            await driver.wait(async () => {
                return (await Database.getCurrentEditor()).match(/Untitled-(\d+)/);
            }, constants.wait5seconds, "Current editor is not Untitled-(*)");
            expect(await Database.getCurrentEditorType()).to.include("scriptJs");
            const result = await Database.execScript("Math.random()");
            expect(result).to.match(/(\d+).(\d+)/);
            await Misc.switchBackToTopFrame();
            const treeOpenEditorsSection = await Misc.getSection(constants.openEditorsTreeSection);
            refItem = await Misc.getTreeScript(treeOpenEditorsSection, "Untitled-", "scriptJs");
            expect(refItem).to.exist;

        });

    });

    describe("Persistent Notebooks", () => {

        const destFile = `${process.cwd()}/test`;

        before(async function () {
            try {
                try {
                    await fs.access(`${destFile}.mysql-notebook`);
                    await fs.unlink(`${destFile}.mysql-notebook`);
                } catch (e) {
                    // continue, file does not exist
                }

                await Misc.sectionFocus(constants.dbTreeSection);
                const treeGlobalConn = await Misc.getTreeElement(constants.dbTreeSection, globalConn.caption);
                await (await Misc.getActionButton(treeGlobalConn, constants.openNewConnection)).click();
                await driver.wait(Until.dbConnectionIsOpened(globalConn), constants.wait15seconds);
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }
        });

        afterEach(async function () {
            if (this.currentTest.state === "failed") {
                await Misc.processFailure(this);
            }

        });

        after(async function () {
            try {
                await Misc.switchBackToTopFrame();
                await new EditorView().closeAllEditors();
                await fs.unlink(`${destFile}.mysql-notebook`);
                const activityBar = new ActivityBar();
                await (await activityBar.getViewControl("MySQL Shell for VS Code"))?.openView();
            } catch (e) {
                await Misc.processFailure(this);
                throw e;
            }
        });

        it("Save Notebook", async () => {

            const result = await CommandExecutor.execute("SELECT VERSION();");
            expect(result.message).to.match(/1 record retrieved/);
            await (await Database.getToolbarButton(constants.saveNotebook)).click();
            await Misc.switchBackToTopFrame();
            await Misc.setInputPath(destFile);
            await driver.wait(new Condition("", async () => {
                try {
                    await fs.access(`${destFile}.mysql-notebook`);

                    return true;
                } catch (e) {
                    return false;
                }
            }), constants.wait5seconds, `File was not saved to ${process.cwd()}`);
        });

        it("Replace this Notebook with content from a file", async () => {

            await Misc.switchToFrame();
            await Misc.cleanEditor();
            await (await Database.getToolbarButton(constants.loadNotebook)).click();
            await Misc.switchBackToTopFrame();
            await Misc.setInputPath(`${destFile}.mysql-notebook`);
            await Misc.switchToFrame();
            await Database.verifyNotebook("SELECT VERSION();", "1 record retrieved");

        });

        it("Open the Notebook from file", async () => {

            await Misc.switchBackToTopFrame();
            await new EditorView().closeAllEditors();
            await browser.openResources(process.cwd());
            await Misc.dismissNotifications();
            let section: CustomTreeSection;
            await driver.wait(async () => {
                section = await Misc.getSection("e2e");

                return section !== undefined;
            }, constants.wait5seconds, "E2E section was not found");


            const file = await section.findItem("test.mysql-notebook", 3);
            await file.click();

            const input = await InputBox.create(constants.wait5seconds * 4);
            await (await input.findQuickPick(globalConn.caption)).select();
            await new EditorView().openEditor("test.mysql-notebook");

            await driver.wait(Until.dbConnectionIsOpened(globalConn), constants.wait15seconds);
            await Database.verifyNotebook("SELECT VERSION();", "1 record retrieved");

        });

        it("Open the Notebook from file with connection", async () => {

            await Misc.switchBackToTopFrame();
            await new EditorView().closeAllEditors();
            await browser.openResources(process.cwd());
            let section: CustomTreeSection;
            await driver.wait(async () => {
                section = await Misc.getSection("e2e");

                return section !== undefined;
            }, constants.wait5seconds, "E2E section was not found");
            const file = await section.findItem("test.mysql-notebook", 3);
            await Misc.openContextMenuItem(file, constants.openNotebookWithConn, constants.checkInput);
            const input = await InputBox.create();
            await (await input.findQuickPick(globalConn.caption)).select();
            await new EditorView().openEditor("test.mysql-notebook");
            await driver.wait(Until.dbConnectionIsOpened(globalConn), constants.wait15seconds);
            await Database.verifyNotebook("SELECT VERSION();", "1 record retrieved");

        });

        it("Auto close notebook tab when DB connection is deleted", async () => {

            await Misc.switchBackToTopFrame();
            await new EditorView().closeEditor("test.mysql-notebook");

            // The file may be dirty
            try {
                const dialog = new ModalDialog();
                await dialog.pushButton(`Don't Save`);
            } catch (e) {
                // continue
            }

            let section: CustomTreeSection;
            await driver.wait(async () => {
                section = await Misc.getSection("e2e");

                return section !== undefined;
            }, constants.wait5seconds, "E2E section was not found");
            const file = await section.findItem("test.mysql-notebook", 3);
            await file.click();
            await driver.wait(Until.dbConnectionIsOpened(globalConn), constants.wait15seconds);
            await Misc.switchBackToTopFrame();
            await new EditorView().openEditor("test.mysql-notebook");
            const activityBar = new ActivityBar();
            await (await activityBar.getViewControl("MySQL Shell for VS Code"))?.openView();
            await Misc.deleteConnection(globalConn.caption);
            const tabs = await new EditorView().getOpenEditorTitles();
            expect(tabs).to.not.include("test.mysql-notebook");
        });

        it("Open the Notebook from file with no DB connections", async () => {

            const conns = await Misc.getDBConnections();

            for (const conn of conns) {
                await Misc.deleteConnection(conn.name, conn.isMySQL);
            }

            const activityBar = new ActivityBar();
            await (await activityBar.getViewControl("Explorer"))?.openView();

            let section: CustomTreeSection;
            await driver.wait(async () => {
                section = await Misc.getSection("e2e");

                return section !== undefined;
            }, constants.wait5seconds, "E2E section was not found");
            const file = await section.findItem("test.mysql-notebook", 3);
            await file.click();
            await new EditorView().openEditor("test.mysql-notebook");
            await Misc.getNotification("Please create a MySQL Database Connection first.");
            await Misc.switchToFrame();
            expect(await driver.findElement(locator.htmlTag.h2).getText()).to.equals("No connection selected");

            await Misc.switchBackToTopFrame();
            await new EditorView().closeAllEditors();

            await Misc.openContextMenuItem(file, constants.openNotebookWithConn, constants.checkNotif);
            await Misc.getNotification("Please create a MySQL Database Connection first.");
        });

    });

});
