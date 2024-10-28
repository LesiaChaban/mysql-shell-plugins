/*
 * Copyright (c) 2020, 2024, Oracle and/or its affiliates.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License, version 2.0,
 * as published by the Free Software Foundation.
 *
 * This program is designed to work with certain software (including
 * but not limited to OpenSSL) that is licensed under separate terms, as
 * designated in a particular file or component or in included license
 * documentation.  The authors of MySQL hereby grant you an additional
 * permission to link the program and your derivative works with the
 * separately licensed software that they have either included with
 * the program or referenced in the documentation.
 *
 * This program is distributed in the hope that it will be useful,  but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
 * the GNU General Public License, version 2.0, for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software Foundation, Inc.,
 * 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA
 */

import defaultIcon from "../../assets/images/file-icons/default.svg";

import connectionIconMySQL from "../../assets/images/connectionMysql.svg";
import connectionIconSQLite from "../../assets/images/connectionSqlite.svg";
import moduleIcon from "../../assets/images/modules/module-sql.svg";
import overviewPageIcon from "../../assets/images/overviewPage.svg";
import scriptingIcon from "../../assets/images/scripting.svg";

import { ComponentChild, createRef, type RefObject } from "preact";

import { IModuleInfo, IModuleProperties, IModuleState, ModuleBase } from "../ModuleBase.js";

import { ICodeEditorModel, type IEditorPersistentState } from "../../components/ui/CodeEditor/CodeEditor.js";
import { CodeEditorMode, Monaco } from "../../components/ui/CodeEditor/index.js";
import { ExecutionContexts } from "../../script-execution/ExecutionContexts.js";
import { appParameters, requisitions } from "../../supplement/Requisitions.js";
import {
    IMrsAuthAppEditRequest, IMrsContentSetEditRequest, IMrsDbObjectEditRequest, IMrsSchemaEditRequest,
    IMrsSdkExportRequest, IMrsUserEditRequest, InitialEditor, type IDocumentOpenData,
} from "../../supplement/RequisitionTypes.js";
import { Settings } from "../../supplement/Settings/Settings.js";
import {
    DBConnectionEditorType, DBType, IConnectionDetails, type IShellSessionDetails,
} from "../../supplement/ShellInterface/index.js";
import { ConnectionBrowser } from "./ConnectionBrowser.js";
import {
    DBConnectionTab, IOpenDocumentState, ISelectItemDetails, type IConnectionPresentationState,
} from "./DBConnectionTab.js";
import {
    DBEditorContext, ISavedGraphData, IToolbarItems, type ISideBarCommandResult, type QualifiedName,
} from "./index.js";

import { ApplicationDB, StoreType } from "../../app-logic/ApplicationDB.js";
import { IMySQLConnectionOptions } from "../../communication/MySQL.js";
import { IMrsServiceData } from "../../communication/ProtocolMrs.js";
import { Button } from "../../components/ui/Button/Button.js";
import { ComponentPlacement } from "../../components/ui/Component/ComponentBase.js";
import { Divider } from "../../components/ui/Divider/Divider.js";
import { Dropdown } from "../../components/ui/Dropdown/Dropdown.js";
import { Icon } from "../../components/ui/Icon/Icon.js";
import { Image } from "../../components/ui/Image/Image.js";
import { defaultEditorOptions } from "../../components/ui/index.js";
import { Label } from "../../components/ui/Label/Label.js";
import { Menu } from "../../components/ui/Menu/Menu.js";
import { IMenuItemProperties, MenuItem } from "../../components/ui/Menu/MenuItem.js";
import { ProgressIndicator } from "../../components/ui/ProgressIndicator/ProgressIndicator.js";
import { ITabviewPage, TabPosition, Tabview } from "../../components/ui/Tabview/Tabview.js";
import { DynamicSymbolTable } from "../../script-execution/DynamicSymbolTable.js";
import { EditorLanguage, IExecutionContext, INewEditorRequest } from "../../supplement/index.js";
import { ShellInterface } from "../../supplement/ShellInterface/ShellInterface.js";
import { ShellInterfaceSqlEditor } from "../../supplement/ShellInterface/ShellInterfaceSqlEditor.js";
import { webSession } from "../../supplement/WebSession.js";
import { convertErrorToString, loadFileAsText, selectFile, uuid } from "../../utilities/helpers.js";
import { DBEditorModuleId } from "../ModuleInfo.js";
import { MrsHub } from "../mrs/MrsHub.js";
import { ExecutionWorkerPool } from "./execution/ExecutionWorkerPool.js";

import { type ISqlUpdateResult, type Mutable } from "../../app-logic/general-types.js";
import { Container, Orientation } from "../../components/ui/Container/Container.js";
import { SplitContainer, type ISplitterPane } from "../../components/ui/SplitContainer/SplitContainer.js";
import scriptingRuntime from "./assets/typings/scripting-runtime.d.ts?raw";
import {
    DBEditorSideBar, documentTypeToFileIcon, pageTypeToDocumentIcon, type IDBEditorSideBarSectionState,
} from "./DBEditorSideBar/DBEditorSideBar.js";

import { ui } from "../../app-logic/UILayer.js";
import {
    CdmEntityType, ConnectionDataModel, type ConnectionDataModelEntry, type ICdmConnectionEntry,
} from "../../data-models/ConnectionDataModel.js";
import type { Command } from "../../data-models/data-model-types.js";
import {
    OciDataModel, type IOciDmBastion, type IOciDmCompartment, type IOciDmComputeInstance, type IOciDmDbSystem,
    type IOciDmProfile, type OciDataModelEntry,
} from "../../data-models/OciDataModel.js";
import {
    OdmEntityType, OpenDocumentDataModel, type IOdmAdminEntry, type IOdmConnectionPageEntry, type IOdmScriptEntry,
    type IOdmShellSessionEntry,
    type IOdmStandaloneDocumentEntry, type LeafDocumentEntry, type LeafDocumentType, type OpenDocumentDataModelEntry,
} from "../../data-models/OpenDocumentDataModel.js";

import type { IChatOptionsState } from "../../components/Chat/ChatOptions.js";
import { DropdownItem } from "../../components/ui/Dropdown/DropdownItem.js";
import { ShellTaskDataModel } from "../../data-models/ShellTaskDataModel.js";
import { parseVersion } from "../../parsing/mysql/mysql-helpers.js";
import { Assets } from "../../supplement/Assets.js";
import { ShellInterfaceShellSession } from "../../supplement/ShellInterface/ShellInterfaceShellSession.js";
import { ShellPromptHandler } from "../common/ShellPromptHandler.js";
import type { IShellEditorModel } from "../shell/index.js";
import { ShellTab, type IShellTabPersistentState } from "../shell/ShellTab.js";
import { LakehouseNavigatorTab } from "./LakehouseNavigator.js";
import { SidebarCommandHandler } from "./SidebarCommandHandler.js";
import { SimpleEditor } from "./SimpleEditor.js";

/**
 * Details generated while adding a new connection tab. These are used in the render method to fill the tab
 * page details.
 */
export interface IConnectionTab {
    /** The corresponding open document data model entry with further details. */
    dataModelEntry: IOdmConnectionPageEntry;

    /**
     * The corresponding connection data model entry. This is actually a duplicate of the entry
     * in the connection data model, to allow using the same connection in multiple tabs.
     */
    connection: ICdmConnectionEntry;

    /**
     * A flag indicating if the about text that is normally shown on first display of a tab should not be
     * shown.
     */
    suppressAbout: boolean;
}

/**
 * Details for a temporary standalone document tab. Used to show text without a connection, e.g. OCI
 * object configurations.
 */
export interface IDocumentTab {
    /** The corresponding open document data model entry with further details. */
    dataModelEntry: IOdmStandaloneDocumentEntry;

    /** The editor state. */
    savedState: IEditorPersistentState;
}

/**
 * Details for a shell session tab.
 */
export interface IShellSessionTab {
    /** The corresponding open document data model entry with further details. */
    dataModelEntry: IOdmShellSessionEntry;

    savedState: IShellTabPersistentState;
}

type IDBEditorModuleProperties = IModuleProperties;

export interface IDBEditorModuleState extends IModuleState {
    /** All currently open connection tabs. */
    connectionTabs: IConnectionTab[];

    /**
     * All currently open temporary document tabs. Not used when embedded in VS Code as the host app will manage
     * such documents.
     */
    documentTabs: IDocumentTab[];

    /** All currently open shell session tabs. */
    shellSessionTabs: IShellSessionTab[];

    sidebarState: Map<string, IDBEditorSideBarSectionState>;

    /** The unique id of the active page. */
    selectedPage: string;

    /** Set when we need to restore a page selection that was temporarily disabled. */
    lastSelectedPage?: string;

    showSidebar: boolean;
    showTabs: boolean;

    /** Progress indicator support. */
    loading: boolean;

    progressMessage: string;
}

export class DBEditorModule extends ModuleBase<IDBEditorModuleProperties, IDBEditorModuleState> {
    // The current UI presentation state of the connection.
    private connectionPresentation: Map<IOdmConnectionPageEntry, IConnectionPresentationState> = new Map();

    private workerPool: ExecutionWorkerPool;

    // For unique naming of editors.
    #documentCounter = 0;

    // For unique naming of shell sessions.
    #sessionCounter = 0;

    #pendingProgress: ReturnType<typeof setTimeout> | null = null;

    #containerRef = createRef<HTMLDivElement>();
    #actionMenuRef = createRef<Menu>();
    #mrsHubRef = createRef<MrsHub>();
    #currentTabRef = createRef<DBConnectionTab>();

    #connectionsDataModel: ConnectionDataModel;
    #documentDataModel: OpenDocumentDataModel;
    #ociDataModel: OciDataModel;
    #shellTaskDataModel: ShellTaskDataModel;

    #sidebarCommandHandler: SidebarCommandHandler;

    public static override get info(): IModuleInfo {
        return {
            id: DBEditorModuleId,
            caption: "DB Editor",
            icon: moduleIcon,
        };
    }

    public constructor(props: IDBEditorModuleProperties) {
        super(props);

        this.workerPool = new ExecutionWorkerPool();

        this.#connectionsDataModel = new ConnectionDataModel();
        this.#connectionsDataModel.autoRouterRefresh = true;

        // The document data model does not need to be initialized. It's built dynamically.
        this.#documentDataModel = new OpenDocumentDataModel();

        // Ditto for the shell task data model.
        this.#shellTaskDataModel = new ShellTaskDataModel();

        this.#ociDataModel = new OciDataModel();

        void Promise.all([
            this.#connectionsDataModel.initialize(),
            this.#ociDataModel.initialize(),
        ]).then(() => {
            this.setState({ loading: false });
        });

        this.#sidebarCommandHandler = new SidebarCommandHandler(this.#connectionsDataModel, this.#mrsHubRef);

        this.state = {
            selectedPage: "",
            connectionTabs: [],
            documentTabs: [],
            shellSessionTabs: [],
            sidebarState: new Map<string, IDBEditorSideBarSectionState>(),
            showSidebar: !appParameters.embedded,
            showTabs: !appParameters.embedded,
            loading: true,
            progressMessage: "",
        };
    }

    public static override getDerivedStateFromProps(props: IDBEditorModuleProperties,
        state: IDBEditorModuleState): Partial<IDBEditorModuleState> {

        const { selectedPage, loading } = state;

        let newSelection = selectedPage;
        if (!newSelection) {
            if (!loading && !appParameters.embedded) {
                newSelection = "connections";
            }
        }

        const newState = {
            selectedPage: newSelection,
        };

        return newState;
    }

    public override componentDidMount(): void {
        requisitions.register("showPage", this.showPage);
        requisitions.register("openDocument", this.handleOpenDocument);
        requisitions.register("openConnectionTab", this.openConnectionTab);
        requisitions.register("sqlSetCurrentSchema", this.setCurrentSchema);
        requisitions.register("editorRunCommand", this.runCommand);
        requisitions.register("editorSaved", this.editorSaved);
        requisitions.register("closeDocument", this.handleCloseDocument);
        requisitions.register("selectDocument", this.handleSelectDocument);
        requisitions.register("createNewEditor", this.createNewEditor);
        requisitions.register("profileLoaded", this.profileLoaded);
        requisitions.register("webSessionStarted", this.webSessionStarted);

        requisitions.register("connectionAdded", this.handleConnectionAdded);
        requisitions.register("connectionUpdated", this.handleConnectionUpdated);
        requisitions.register("connectionRemoved", this.handleConnectionRemoved);
        requisitions.register("refreshConnection", this.handleRefreshConnection);
        requisitions.register("removeSession", this.removeSession);

        requisitions.register("showMrsDbObjectDialog", this.showMrsDbObjectDialog);
        requisitions.register("showMrsServiceDialog", this.showMrsServiceDialog);
        requisitions.register("showMrsSchemaDialog", this.showMrsSchemaDialog);
        requisitions.register("showMrsContentSetDialog", this.showMrsContentSetDialog);
        requisitions.register("showMrsAuthAppDialog", this.showMrsAuthAppDialog);
        requisitions.register("showMrsUserDialog", this.showMrsUserDialog);
        requisitions.register("showMrsSdkExportDialog", this.showMrsSdkExportDialog);

        requisitions.register("openSession", this.openSession);

        if (this.#containerRef.current && !appParameters.embedded) {
            this.#containerRef.current.addEventListener("keydown", this.handleKeyPress);
        }
    }

    public override componentWillUnmount(): void {
        if (this.#containerRef.current && !appParameters.embedded) {
            this.#containerRef.current.removeEventListener("keydown", this.handleKeyPress);
        }

        requisitions.unregister("showPage", this.showPage);
        requisitions.unregister("openDocument", this.handleOpenDocument);
        requisitions.unregister("openConnectionTab", this.openConnectionTab);
        requisitions.unregister("sqlSetCurrentSchema", this.setCurrentSchema);
        requisitions.unregister("editorRunCommand", this.runCommand);
        requisitions.unregister("editorSaved", this.editorSaved);
        requisitions.unregister("closeDocument", this.handleCloseDocument);
        requisitions.unregister("selectDocument", this.handleSelectDocument);
        requisitions.unregister("createNewEditor", this.createNewEditor);
        requisitions.unregister("profileLoaded", this.profileLoaded);
        requisitions.unregister("webSessionStarted", this.webSessionStarted);

        requisitions.unregister("connectionAdded", this.handleConnectionAdded);
        requisitions.unregister("connectionUpdated", this.handleConnectionUpdated);
        requisitions.unregister("connectionRemoved", this.handleConnectionRemoved);
        requisitions.unregister("refreshConnection", this.handleRefreshConnection);
        requisitions.unregister("removeSession", this.removeSession);

        requisitions.unregister("showMrsDbObjectDialog", this.showMrsDbObjectDialog);
        requisitions.unregister("showMrsServiceDialog", this.showMrsServiceDialog);
        requisitions.unregister("showMrsSchemaDialog", this.showMrsSchemaDialog);
        requisitions.unregister("showMrsContentSetDialog", this.showMrsContentSetDialog);
        requisitions.unregister("showMrsAuthAppDialog", this.showMrsAuthAppDialog);
        requisitions.unregister("showMrsUserDialog", this.showMrsUserDialog);
        requisitions.unregister("showMrsSdkExportDialog", this.showMrsSdkExportDialog);

        requisitions.unregister("openSession", this.openSession);
    }

    public override render(): ComponentChild {
        const { innerRef } = this.props;
        const {
            selectedPage, connectionTabs, documentTabs, shellSessionTabs, sidebarState, showSidebar, showTabs, loading,
            progressMessage } = this.state;

        let sqlIcon = Assets.file.mysqlIcon;
        const isEmbedded = appParameters.embedded;

        // Generate the main toolbar items based on the current display mode.
        const toolbarItems: IToolbarItems = { navigation: [], execution: [], editor: [], auxillary: [] };
        const dropDownItems = [
            <DropdownItem
                id="connections"
                key="connections"
                caption="DB Connection Overview"
                picture={<Icon src={overviewPageIcon} />}
            />,
        ];

        let selectedEntry: string | undefined;
        connectionTabs.forEach((info: IConnectionTab) => {
            const page = info.dataModelEntry;
            const connectionState = this.connectionPresentation.get(page)!;

            // Add one entry per connection.
            const iconName = page.details.dbType === DBType.MySQL
                ? connectionIconMySQL
                : connectionIconSQLite;

            dropDownItems.push(
                <DropdownItem
                    key={page.id}
                    caption={info.dataModelEntry.caption}
                    picture={<Icon src={iconName} />}
                    payload={info.dataModelEntry}
                />,
            );

            // After that add an entry for each open document (indented).
            connectionState.documentStates.forEach((entry) => {
                let picture;
                if (entry.state) {
                    const language = entry.state.model.getLanguageId() as EditorLanguage;
                    const iconName = documentTypeToFileIcon.get(language);
                    if (language === "msg") {
                        picture = <Icon src={iconName ?? defaultIcon} />;
                    } else {
                        picture = <Image src={iconName as string ?? defaultIcon} />;
                    }
                } else if (entry.document.type === OdmEntityType.AdminPage) {
                    const name = pageTypeToDocumentIcon.get((entry.document).pageType) ?? defaultIcon;
                    picture = <Icon src={name} />;
                }

                dropDownItems.push((
                    <DropdownItem
                        page={page.id}
                        document={entry.document}
                        id={entry.document.id}
                        key={entry.document.id}
                        caption={entry.document.caption}
                        picture={picture}
                        style={{ marginLeft: 16 }}
                        payload={entry.document}
                    />
                ));

                if (selectedPage === page.id && entry.document.id === connectionState.activeEntry) {
                    selectedEntry = entry.document.id;

                    if (page.details.dbType === DBType.Sqlite) {
                        sqlIcon = Assets.file.sqliteIcon;
                    }
                }
            });
        });

        documentTabs.forEach((info) => {
            const document = info.dataModelEntry;
            const iconName = documentTypeToFileIcon.get(document.language!) ?? Assets.file.defaultIcon;

            dropDownItems.push(
                <DropdownItem
                    key={document.id}
                    id={document.id}
                    caption={info.dataModelEntry.caption}
                    picture={<Icon src={iconName} />}
                    payload={info.dataModelEntry}
                />,
            );
        });

        if (shellSessionTabs.length > 0) {
            const root = shellSessionTabs[0].dataModelEntry.parent;
            dropDownItems.push(
                <DropdownItem
                    key={root.id}
                    id={root.id}
                    caption={root.caption}
                    picture={<Icon src={Assets.documents.sessionIcon} />}
                />,
            );

            shellSessionTabs.forEach((info) => {
                const document = info.dataModelEntry;
                dropDownItems.push(
                    <DropdownItem
                        key={document.id}
                        id={document.id}
                        caption={info.dataModelEntry.caption}
                        picture={<Icon src={Assets.documents.sessionIcon} />}
                        style={{ marginLeft: 16 }}
                        payload={info.dataModelEntry}
                    />,
                );
            });
        }

        toolbarItems.navigation.push(
            <Label key="mainLabel" style={{ marginRight: "8px" }}>Editor:</Label>,
            <Dropdown
                id="documentSelector"
                key="selector"
                selection={selectedEntry ?? selectedPage}
                onSelect={this.handleDropdownSelection}
            >
                {dropDownItems}
            </Dropdown>,
        );

        if (selectedPage === "connections") {
            toolbarItems.navigation.push(
                <Button
                    key="button1"
                    id="newConsoleMenuButton"
                    data-tooltip="Open New Shell Console"
                    style={{ marginLeft: "4px" }}
                    onClick={this.addNewConsole}
                >
                    <Icon key="newIcon" src={Assets.toolbar.newShellConsoleIcon} data-tooltip="inherit" />
                </Button>,
                <Divider key="divider2" id="actionDivider" vertical={true} thickness={1} />,
            );
        }

        const pages: ITabviewPage[] = [];

        let actualSelection = selectedPage;
        if (loading) {
            const content = <>
                <ProgressIndicator
                    id="loadingProgressIndicator"
                    backgroundOpacity={0.95}
                    linear={false}
                />
                <Label
                    id="progressMessageId"
                    caption={progressMessage}
                />
            </>;

            pages.push({
                icon: overviewPageIcon,
                caption: "Open Connection",
                id: "progress",
                content,
            });
            actualSelection = "progress";

        } else {
            const overview = (
                <Container
                    id="overviewHost"
                    orientation={Orientation.TopDown}
                >
                    <ConnectionBrowser
                        toolbarItems={toolbarItems}
                        onAddConnection={this.handleAddConnection}
                        onUpdateConnection={this.handleUpdateConnection}
                        onRemoveConnection={this.handleRemoveConnection}
                    />
                </Container>
            );

            pages.push({
                icon: overviewPageIcon,
                caption: "Connection Overview",
                id: "connections",
                content: overview,
            });
        }

        let selectedDocument = "connections";
        connectionTabs.forEach((info: IConnectionTab) => {
            const page = info.dataModelEntry;
            const connectionState = this.connectionPresentation.get(page)!;
            const content = (<DBConnectionTab
                id={page.id}
                ref={page.id === actualSelection ? this.#currentTabRef : undefined}
                caption={page.caption}
                showAbout={!info.suppressAbout}
                workerPool={this.workerPool}
                connection={info.connection}
                toolbarItems={toolbarItems}
                extraLibs={[{ code: scriptingRuntime, path: "runtime" }]}
                savedState={connectionState}
                onHelpCommand={this.handleHelpCommand}
                onAddEditor={this.handleAddNotebook}
                onRemoveEditor={this.handleRemoveDocument}
                onLoadScript={this.handleLoadScript}
                onSelectItem={this.handleSelectItem}
                onEditorRename={this.handleEditorRename}
                onGraphDataChange={this.handleGraphDataChange}
                onChatOptionsChange={this.onChatOptionsChange}
            />);

            if (page.id === selectedPage) {
                selectedDocument = connectionState.activeEntry;
            }

            pages.push({
                icon: scriptingIcon,
                caption: page.caption,
                id: page.id,
                content,
                auxiliary: (
                    <Button
                        id={page.id}
                        className="closeButton"
                        round={true}
                        onClick={this.handleCloseTab}>
                        <Icon src={Assets.misc.closeIcon2} />
                    </Button>
                ),
            });
        });

        documentTabs.forEach((info: IDocumentTab) => {
            const document = info.dataModelEntry;
            const content = (<SimpleEditor
                key={document.id}
                id={document.id}
                savedState={info.savedState}
                fileName={document.caption}
                toolbarItemsTemplate={toolbarItems}
            />);

            if (document.id === selectedPage) {
                selectedDocument = selectedPage;
            }

            pages.push({
                icon: scriptingIcon,
                caption: document.caption,
                id: document.id,
                content,
                auxiliary: (
                    <Button
                        id={document.id}
                        className="closeButton"
                        round={true}
                        onClick={this.handleCloseTab}>
                        <Icon src={Assets.misc.closeIcon2} />
                    </Button>
                ),
            });
        });

        shellSessionTabs.forEach((info) => {
            const document = info.dataModelEntry;
            const content = (<ShellTab
                key={document.id}
                id={document.id}
                savedState={info.savedState}
                toolbarItemsTemplate={toolbarItems}
                onQuit={(id) => { void this.removeShellTab(id); }}
            />);

            if (document.id === selectedPage) {
                selectedDocument = selectedPage;
            }

            pages.push({
                icon: scriptingIcon,
                caption: document.caption,
                id: document.id,
                content,
                auxiliary: (
                    <Button
                        id={document.id}
                        className="closeButton"
                        round={true}
                        onClick={this.handleCloseTab}>
                        <Icon src={Assets.misc.closeIcon2} />
                    </Button>
                ),
            });
        });

        const className = "dbModuleTabview";
        const content = <>
            <Tabview
                className={className}
                tabPosition={TabPosition.Top}
                selectedId={actualSelection}
                stretchTabs={false}
                showTabs={showTabs}
                canReorderTabs
                pages={pages}
                onSelectTab={this.handleSelectTab}
            />
            {isEmbedded &&
                <Menu
                    key="actionMenu"
                    id="editorToolbarActionMenu"
                    ref={this.#actionMenuRef}
                    placement={ComponentPlacement.BottomLeft}
                    onItemClick={this.handleNewScriptClick}
                >
                    <MenuItem
                        key="item1"
                        command={{ title: "New DB Notebook", command: "addEditor" }}
                        icon={Assets.misc.newNotebookIcon}
                    />
                    <MenuItem
                        key="item2"
                        command={{ title: "New SQL Script", command: "addSQLScript" }}
                        icon={sqlIcon}
                    />
                    <MenuItem
                        key="item3"
                        command={{ title: "New TS Script", command: "addTSScript" }}
                        icon={Assets.file.typescriptIcon}
                    />
                    <MenuItem
                        key="item4"
                        command={{ title: "New JS Script", command: "addJSScript" }}
                        icon={Assets.file.javascriptIcon}
                    />
                </Menu>
            }
            <MrsHub ref={this.#mrsHubRef} />
        </>;

        const selectedTab = connectionTabs.find((entry) => { return entry.dataModelEntry.id === selectedPage; });

        const splitterPanes: ISplitterPane[] = [];
        if (!appParameters.embedded) {
            // Don't render the sidebar when embedded.
            splitterPanes.push({
                content: <DBEditorSideBar
                    selectedOpenDocument={selectedDocument}
                    markedSchema={selectedTab?.connection.currentSchema ?? ""}
                    savedSectionState={sidebarState}
                    onSaveState={this.handleSaveExplorerState}
                    onSelectDocumentItem={this.handleDocumentSelection}
                    onSelectConnectionItem={this.handleConnectionEntrySelection}
                    onConnectionTreeCommand={this.handleSideBarConnectionCommand}
                    onDocumentTreeCommand={this.handleSideBarDocumentCommand}
                    onOciTreeCommand={this.handleSideBarOciCommand}
                />,
                minSize: 0,
                initialSize: showSidebar ? 250 : 0,
                resizable: true,
                snap: true,
                collapsed: !showSidebar,
            });
        }

        splitterPanes.push({
            content,
            minSize: 500,
            resizable: true,
            stretch: true,
        });

        return (
            <DBEditorContext.Provider
                value={{
                    connectionsDataModel: this.#connectionsDataModel,
                    documentDataModel: this.#documentDataModel,
                    ociDataModel: this.#ociDataModel,
                    shellTaskDataModel: this.#shellTaskDataModel,
                }}>

                <div
                    className="moduleHost"
                    ref={innerRef as RefObject<HTMLDivElement>}
                >
                    <SplitContainer
                        id="mainSplitHost"
                        innerRef={this.#containerRef}
                        orientation={Orientation.LeftToRight}
                        panes={splitterPanes}
                    />
                </div>
            </DBEditorContext.Provider >
        );
    }

    public handlePushConnection = (entry: ICdmConnectionEntry): void => {
        this.#connectionsDataModel.addConnectionEntry(entry);
    };

    private handleKeyPress = (event: KeyboardEvent): void => {
        if (event.metaKey && event.key === "b") {
            event.preventDefault();

            const { showSidebar } = this.state;

            this.setState({ showSidebar: !showSidebar });
        }
    };

    private handleAddConnection = (entry: ICdmConnectionEntry): void => {
        ShellInterface.dbConnections.addDbConnection(webSession.currentProfileId, entry.details, "")
            .then((connectionId) => {
                if (connectionId !== undefined) {
                    entry.details.id = connectionId;
                    this.#connectionsDataModel.addConnectionEntry(entry);

                    requisitions.executeRemote("connectionAdded", entry.details);
                }
            }).catch((reason) => {
                const message = reason instanceof Error ? reason.message : String(reason);
                void requisitions.execute("showError", "Cannot add DB connection: " + message);

            });
    };

    private handleUpdateConnection = (entry: ICdmConnectionEntry): void => {
        ShellInterface.dbConnections.updateDbConnection(webSession.currentProfileId, entry.details).then(() => {
            this.#connectionsDataModel.updateConnectionDetails(entry);
            requisitions.executeRemote("connectionUpdated", entry.details);
        }).catch((reason) => {
            const message = reason instanceof Error ? reason.message : String(reason);
            void requisitions.execute("showError", "Cannot update DB connection: " + message);
        });
    };

    private handleRemoveConnection = (entry: ICdmConnectionEntry): void => {
        ShellInterface.dbConnections.removeDbConnection(webSession.currentProfileId, entry.details.id).then(() => {
            // Close and remove the connection.
            void this.#connectionsDataModel.removeEntry(entry);
            void this.#connectionsDataModel.dropItem(entry);

            requisitions.executeRemote("connectionRemoved", entry.details);
        }).catch((reason) => {
            const message = reason instanceof Error ? reason.message : String(reason);
            void requisitions.execute("showError", "Cannot remove DB connection: " + message);
        });
    };

    private showPage = async (
        data: { module: string; page: string; suppressAbout?: boolean; editor?: InitialEditor; }): Promise<boolean> => {
        if (data.module === DBEditorModuleId) {
            const { connectionTabs, selectedPage } = this.state;

            let connection: ICdmConnectionEntry | undefined;

            // XXX: rework this to use the real id of the documents, not just the connection id (or "connections").
            if (data.page !== "connections") {
                const id = parseInt(data.page, 10);
                connection = this.#connectionsDataModel.findConnectionEntryById(id);
            }

            const doShowPage = (): Promise<boolean> => {
                if (data.page === "connections") {
                    this.showOverview();

                    return Promise.resolve(true);
                } else if (connection) {
                    return this.activateConnectionTab(connection, false, data.suppressAbout ?? false,
                        data.editor ?? "default");
                }

                return Promise.resolve(false);
            };

            if (this.#currentTabRef.current) {
                // See if we already have this page open. If that's the case we don't need to do anything.
                let entry: IConnectionTab | undefined;

                if (connection) { // The connection is not assigned when switching to the overview.
                    entry = connectionTabs.find((entry: IConnectionTab) => {
                        return (entry.connection.details.id === connection.details.id);
                    });
                }

                if (entry && entry.dataModelEntry.id === selectedPage) {
                    return Promise.resolve(true);
                }

                const canClose = await this.#currentTabRef.current.canClose();
                if (canClose) {
                    return doShowPage();
                } else {
                    // Pretend we handled the requisition in case of a rejection, to avoid
                    // multiple attempts to open the new page while the requisition pipeline tries to resolve it.
                    return Promise.resolve(true);
                }
            } else {
                return doShowPage();
            }
        }

        return Promise.resolve(false);
    };

    private handleOpenDocument = async (data: IDocumentOpenData): Promise<boolean> => {
        if (!data.connection) {
            return false;
        }

        const { connectionTabs } = this.state;

        const connection = this.#connectionsDataModel.findConnectionEntryById(data.connection.id);
        if (!connection) {
            return false;
        }

        const canClose = this.#currentTabRef.current ? (await this.#currentTabRef.current.canClose()) : true;
        if (!canClose) {
            return true;
        }

        await this.activateConnectionTab(connection, false, false, "none");

        const tab = connectionTabs.find((tab) => {
            return tab.connection.details.id === connection.details.id;
        });

        if (tab) {
            const document = this.#documentDataModel.openDocument(undefined, {
                type: data.documentDetails.type,
                parameters: {
                    pageId: tab.dataModelEntry.id,
                    id: data.documentDetails.id,
                    caption: data.documentDetails.caption,
                    connection: connection.details,
                    language: data.documentDetails.language,
                    pageType: data.documentDetails.pageType,
                },
            });

            if (document) {
                this.handleSelectItem({
                    document: document as LeafDocumentEntry,
                    tabId: tab.dataModelEntry.id,
                });
            }
        }

        return true;
    };

    private openConnectionTab = (data: {
        connection: ICdmConnectionEntry; force: boolean; initialEditor?: InitialEditor;
    }): Promise<boolean> => {
        return this.activateConnectionTab(data.connection, data.force, false, data.initialEditor);
    };

    private setCurrentSchema = (data: { id: string; connectionId: number; schema: string; }): Promise<boolean> => {
        return new Promise((resolve) => {
            const { connectionTabs } = this.state;

            // Update all editor tabs with this connection.
            connectionTabs.forEach((tab: IConnectionTab) => {
                // Either update the current schema only for the given tab or for all tabs using the same connection
                // id (if no tab id is given).
                if (tab.connection.details.id === data.connectionId || data.id === tab.dataModelEntry.id) {
                    const connectionState = this.connectionPresentation.get(tab.dataModelEntry)!;
                    if (connectionState) {
                        // Change for chat options
                        this.onChatOptionsChange(data.id.length > 0 ? data.id : tab.dataModelEntry.id, {
                            options: {
                                ...connectionState.chatOptionsState.options,
                                schemaName: data.schema,
                            },
                        });

                        // Change for new editors.
                        tab.connection.currentSchema = data.schema;

                        // Change existing editors.
                        connectionState.documentStates.forEach((state) => {
                            if (state.state) {
                                const contexts = state.state.model.executionContexts;
                                if (contexts) {
                                    contexts.currentSchema = data.schema;
                                }
                            }
                        });
                    }
                }
            });

            this.setState({ connectionTabs }, () => { resolve(true); });
        });
    };

    /**
     * Activates the overview page (no tab selected).
     */
    private showOverview(): void {
        this.setState({ selectedPage: "connections" });
        requisitions.executeRemote("selectConnectionTab", { connectionId: -1 });

    }

    private runCommand = (details: { command: string; context: IExecutionContext; }): Promise<boolean> => {
        return new Promise((resolve) => {
            switch (details.command) {
                case "sendBlockUpdates": {
                    // Called when editor changes must be sent back to a host.
                    if (details.context.linkId) {
                        requisitions.executeRemote("codeBlocksUpdate", {
                            linkId: details.context.linkId,
                            code: details.context.code,
                        });
                        resolve(true);
                    }

                    break;
                }

                default: {
                    resolve(false);
                    break;
                }
            }
        });
    };

    /**
     * Called when the profile changes *after* the initial profile load.
     *
     * @returns A promise always fulfilled to true.
     */
    private profileLoaded = async (): Promise<boolean> => {
        await this.#connectionsDataModel.reloadConnections();

        return true;
    };

    private webSessionStarted = async (): Promise<boolean> => {
        // A new web session was established while the module is active. That means previous editor sessions
        // are invalid now and we have to reopen new sessions.
        const { connectionTabs } = this.state;

        await this.#connectionsDataModel.closeAllConnections();
        for (const tab of connectionTabs) {
            const state = this.connectionPresentation.get(tab.dataModelEntry);
            if (state) {
                await tab.connection.refresh?.();
            }
        }

        return true;
    };

    /**
     * Called when a new connection was added from outside (usually the application host like the VS Code extension).
     *
     * @param details The connection details.
     *
     * @returns A promise always fulfilled to true.
     */
    private handleConnectionAdded = (details: IConnectionDetails): Promise<boolean> => {
        const entry = this.#connectionsDataModel.createConnectionEntry(details);
        this.#connectionsDataModel.addConnectionEntry(entry);

        return Promise.resolve(true);
    };

    /**
     * Called when a connection was changed from outside (usually the application host like the VS Code extension).
     *
     * @param details The connection details.
     *
     * @returns A promise always fulfilled to true.
     */
    private handleConnectionUpdated = (details: IConnectionDetails): Promise<boolean> => {
        this.#connectionsDataModel.updateConnectionDetails(details);

        return Promise.resolve(true);
    };

    /**
     * Called when a new connection was removed from outside (usually the application host like the VS Code extension).
     *
     * @param details The connection details.
     *
     * @returns A promise always fulfilled to true.
     */
    private handleConnectionRemoved = async (details: IConnectionDetails): Promise<boolean> => {
        const connection = this.#connectionsDataModel.findConnectionEntryById(details.id);
        if (connection) {
            await this.#connectionsDataModel.removeEntry(connection);
        }

        return true;
    };

    private handleRefreshConnection = async (): Promise<boolean> => {
        await this.#connectionsDataModel.reloadConnections();

        return true;
    };

    private removeSession = async (details: IShellSessionDetails): Promise<boolean> => {
        await this.removeShellTab(details.sessionId);

        return true;
    };

    private showMrsDbObjectDialog = async (request: IMrsDbObjectEditRequest): Promise<boolean> => {
        if (this.#mrsHubRef.current) {
            const { selectedPage, connectionTabs } = this.state;
            const tab = connectionTabs.find((entry) => { return entry.dataModelEntry.id === selectedPage; });
            if (tab) {
                return this.#mrsHubRef.current.showMrsDbObjectDialog(tab.connection.backend, request);
            }
        }

        return false;
    };

    private showMrsServiceDialog = async (data?: IMrsServiceData): Promise<boolean> => {
        if (this.#mrsHubRef.current) {
            const { selectedPage, connectionTabs } = this.state;
            const tab = connectionTabs.find((entry) => { return entry.dataModelEntry.id === selectedPage; });
            if (tab) {
                const result = await this.#mrsHubRef.current.showMrsServiceDialog(tab.connection.backend, data);
                if (result) {
                    const connection = this.#connectionsDataModel.findConnectionEntryById(tab.connection.details.id);
                    if (connection) {
                        void requisitions.executeRemote("updateMrsRoot", String(connection.details.id));
                    }
                }

                return result;
            }
        }

        return false;
    };

    private showMrsSchemaDialog = async (request: IMrsSchemaEditRequest): Promise<boolean> => {
        if (this.#mrsHubRef.current) {
            const { selectedPage, connectionTabs } = this.state;
            const tab = connectionTabs.find((entry) => { return entry.dataModelEntry.id === selectedPage; });
            if (tab) {
                await this.#mrsHubRef.current.showMrsSchemaDialog(tab.connection.backend, request.schemaName,
                    request.schema);

                return true;
            }
        }

        return false;
    };

    private showMrsContentSetDialog = async (request: IMrsContentSetEditRequest): Promise<boolean> => {
        if (this.#mrsHubRef.current) {
            const { selectedPage, connectionTabs } = this.state;
            const tab = connectionTabs.find((entry) => { return entry.dataModelEntry.id === selectedPage; });
            if (tab) {
                return this.#mrsHubRef.current.showMrsContentSetDialog(tab.connection.backend, request.directory,
                    request.contentSet, request.requestPath);
            }
        }

        return false;
    };

    private showMrsAuthAppDialog = async (request: IMrsAuthAppEditRequest): Promise<boolean> => {
        if (this.#mrsHubRef.current) {
            const { selectedPage, connectionTabs } = this.state;
            const tab = connectionTabs.find((entry) => { return entry.dataModelEntry.id === selectedPage; });
            if (tab) {
                return this.#mrsHubRef.current.showMrsAuthAppDialog(tab.connection.backend, request.authApp,
                    request.service);
            }
        }

        return false;
    };

    private showMrsUserDialog = async (request: IMrsUserEditRequest): Promise<boolean> => {
        if (this.#mrsHubRef.current) {
            const { selectedPage, connectionTabs } = this.state;
            const tab = connectionTabs.find((entry) => { return entry.dataModelEntry.id === selectedPage; });
            if (tab) {
                return this.#mrsHubRef.current.showMrsUserDialog(tab.connection.backend, request.authApp,
                    request.user);
            }
        }

        return false;
    };

    private showMrsSdkExportDialog = async (request: IMrsSdkExportRequest): Promise<boolean> => {
        if (this.#mrsHubRef.current) {
            const { selectedPage, connectionTabs } = this.state;
            const tab = connectionTabs.find((entry) => { return entry.dataModelEntry.id === selectedPage; });
            if (tab) {
                return this.#mrsHubRef.current.showMrsSdkExportDialog(tab.connection.backend, request.serviceId,
                    request.connectionId, request.connectionDetails, request.directory);
            }
        }

        return false;
    };

    private openSession = async (details: IShellSessionDetails): Promise<boolean> => {
        const canClose = this.#currentTabRef.current ? (await this.#currentTabRef.current.canClose()) : true;
        if (!canClose) {
            return true;
        }

        await this.activateShellTab(details.sessionId, details.dbConnectionId, details.caption);

        return true;
    };

    /**
     * Activates the tab for the given connection. If the tab already exists it is simply activated, otherwise a new
     * tab is created.
     *
     * @param entry The connection for which to open/activate the tab.
     * @param force If true then create a new tab, even if one for the same connection already exists.
     * @param suppressAbout If true then no about text is show when opening the tab.
     * @param initialEditor Indicates what type of editor to open initially.
     *
     * @returns A promise fulfilled once the connect tab is added.
     */
    private activateConnectionTab = async (entry: ICdmConnectionEntry, force: boolean, suppressAbout: boolean,
        initialEditor?: InitialEditor): Promise<boolean> => {
        const { connectionTabs } = this.state;

        // Count how many tabs we already have for this connection and keep the last one.
        let counter = 1;
        let foundEntry: IConnectionTab | undefined;
        connectionTabs.forEach((info: IConnectionTab) => {
            if (info.connection.details.id === entry.details.id) {
                ++counter;
                foundEntry = info;
            }
        });

        if (foundEntry && !force) {
            // We already have a tab for that connection and a new tab wasn't enforced,
            // so simply activate that existing tab.
            await this.setStatePromise({ selectedPage: foundEntry.dataModelEntry.id });
        } else {
            const suffix = counter > 1 ? ` (${counter})` : "";
            this.showProgress();
            this.setProgressMessage("Starting editor session...");

            // Create a new connection entry for the tab. It's open by default.
            try {
                const newEntry = await entry.duplicate();
                await this.addNewTab(newEntry, suffix, suppressAbout, initialEditor);
            } catch (error) {
                void ui.showErrorNotification(convertErrorToString(error));
            } finally {
                this.hideProgress(true);
            }
        }

        // Always return true to indicated we handled the request.
        return true;
    };

    /**
     * Creates a new tab and initializes the saved state for it.
     *
     * @param connection The new connection for which to add the tab.
     * @param tabSuffix An additional string to add to the caption of the tab we are about to create and open.
     * @param suppressAbout If true then no about text is shown.
     * @param initialEditor Determines what type of editor to open initially.
     *
     * @returns A promise which fulfills once the connection is open.
     */
    private async addNewTab(connection: ICdmConnectionEntry, tabSuffix: string,
        suppressAbout: boolean, initialEditor: InitialEditor = "default"): Promise<boolean> {

        const { connectionTabs } = this.state;

        try {
            this.setProgressMessage("Connection opened, creating the editor...");

            // XXX: convert to uuid.
            const tab = this.#documentDataModel.addConnectionTab(undefined, connection.details);

            // Once the connection is open we can create the editor.
            let currentSchema = "";
            if (connection.currentSchema) {
                currentSchema = connection.currentSchema;
            } else if (connection.details.dbType === DBType.MySQL) {
                currentSchema = (connection.details.options as IMySQLConnectionOptions).schema ?? "";
            }

            const details = connection.details;
            const sqlMode = details.sqlMode ?? Settings.get("editor.sqlMode", "");
            const serverVersion = details.version ?? Settings.get("editor.dbVersion", 80024);
            const heatWaveEnabled = details.heatWaveAvailable ?? false;

            const entryId = uuid();
            let useNotebook;
            if (connection.details.settings && connection.details.settings.defaultEditor) {
                useNotebook = connection.details.settings.defaultEditor === DBConnectionEditorType.DbNotebook;
            } else {
                useNotebook = Settings.get("dbEditor.defaultEditor", "notebook") === "notebook";
            }

            // Get the execution history entries for this connection, but only fetch the first 30 chars of the code
            // for preview purposes
            const executionHistory = await connection.backend.getExecutionHistoryEntries(connection.details.id, 30);

            let type: LeafDocumentType;
            if (initialEditor === undefined || initialEditor === "default") {
                type = useNotebook ? OdmEntityType.Notebook : OdmEntityType.Script;
            } else {
                type = initialEditor === "notebook" ? OdmEntityType.Notebook : OdmEntityType.Script;
            }

            const language: EditorLanguage = type === OdmEntityType.Notebook ? "msg" : "mysql";

            const documentStates: IOpenDocumentState[] = [];

            let newState: Mutable<Partial<IOpenDocumentState>> | undefined;
            const editorCaption = type === OdmEntityType.Script ? "Script" : "DB Notebook";

            if (initialEditor !== "none") {
                const model = this.createEditorModel(connection.backend, "", language, serverVersion, sqlMode,
                    currentSchema);

                newState = {
                    state: {
                        model,
                        viewState: null,
                        options: defaultEditorOptions,
                    },
                    currentVersion: model.getVersionId(),
                };
                documentStates.push(newState as IOpenDocumentState);
            }

            const connectionState: IConnectionPresentationState = {
                activeEntry: entryId,
                documents: [],
                documentStates,
                heatWaveEnabled,
                mleEnabled: false,
                adminPageStates: {
                    lakehouseNavigatorState: {
                        activeTabId: LakehouseNavigatorTab.Overview,
                    },
                },
                graphData: {
                    timestamp: 0,
                    activeColorScheme: "classic",
                    displayInterval: 50,
                    currentValues: new Map(),
                    computedValues: {},
                    series: new Map(),
                },

                // Chat option defaults
                chatOptionsState: {
                    chatOptionsExpanded: false,
                    chatOptionsWidth: -1,
                    options: {
                        schemaName: currentSchema !== "" ? currentSchema : undefined,
                        modelOptions: {
                            modelId: "default",
                        },
                    },
                },

                executionHistory,
                currentExecutionHistoryIndex: 0,
            };

            this.connectionPresentation.set(tab, connectionState);

            tab.caption = connection.details.caption + tabSuffix;
            connectionTabs.push({
                dataModelEntry: tab,
                connection,
                suppressAbout,
            });

            if (newState) {
                const parameters = {
                    type,
                    parameters: {
                        pageId: tab.id,
                        id: entryId,
                        caption: editorCaption,
                        connection: connection.details,
                        language,
                    },
                };

                const document = this.#documentDataModel.openDocument(undefined, parameters);
                if (document) {
                    connectionState.documents.push(document);
                    newState.document = document;

                    this.notifyRemoteEditorOpen(tab.id, document, connection.details);
                }

            }

            this.hideProgress(false);
            await this.setStatePromise({ connectionTabs, selectedPage: tab.id, loading: false });
        } catch (reason) {
            const message = reason instanceof Error ? reason.message : String(reason);
            void requisitions.execute("showError", "Connection Error: " + message);

            const { lastSelectedPage } = this.state;
            await this.setStatePromise({ selectedPage: lastSelectedPage ?? "connections" });
            this.hideProgress(true);
        }

        return true;
    }

    /**
     * Handles closing of a single tab (via its close button).
     *
     * @param e The mouse event.
     */
    private handleCloseTab = (e: MouseEvent | KeyboardEvent): void => {
        e.stopPropagation();
        const id = (e.currentTarget as HTMLElement).id;

        if (this.#currentTabRef.current) {
            void this.#currentTabRef.current.canClose().then((canClose) => {
                if (canClose) {
                    void this.removeTab(id);
                }
            });
        } else {
            void this.removeTab(id);
        }
    };

    /**
     * Completely removes a tab, with all its editors (if the tab is a connection tab).
     *
     * @param tabId The ID of the tab to remove. For standalone documents this is equal to the document ID.
     *
     * @returns A promise resolving to true, when the tab removal is finished.
     */
    private async removeTab(tabId: string): Promise<boolean> {
        const { selectedPage, connectionTabs, documentTabs, shellSessionTabs } = this.state;

        let index = shellSessionTabs.findIndex((info) => {
            return info.dataModelEntry.id === tabId;
        });

        if (index > -1) {
            return this.removeShellTab(tabId);
        }

        // Remove all result data from the application DB.
        await ApplicationDB.removeDataByTabId(StoreType.DbEditor, tabId);

        // Remove tab info from the connection state and select another tab.
        index = connectionTabs.findIndex((info: IConnectionTab) => {
            return info.dataModelEntry.id === tabId;
        });

        if (index > -1) {
            const info = connectionTabs[index];
            const page = connectionTabs[index].dataModelEntry;

            // Remove the editor tab and its associated connection state, but watch out:
            // Order is important here. First remove the tab, then set the state and finally close the session.
            connectionTabs.splice(index, 1);

            let newSelection = selectedPage;

            if (tabId === newSelection) {
                if (index > 0) {
                    newSelection = connectionTabs[index - 1].dataModelEntry.id;
                } else {
                    if (index >= connectionTabs.length - 1) {
                        newSelection = "connections"; // The overview page cannot be closed.
                    } else {
                        newSelection = connectionTabs[index + 1].dataModelEntry.id;
                    }
                }
            }

            this.setState({ selectedPage: newSelection, connectionTabs });

            const connectionState = this.connectionPresentation.get(page);
            if (connectionState) {
                this.notifyRemoteEditorClose(tabId);

                this.#documentDataModel.closeDocument(undefined, {
                    pageId: tabId,
                    connectionId: page.details.id,
                });

                // Release all editor models.
                connectionState.documentStates.forEach((editor) => {
                    const model = editor.state?.model;
                    if (model) {
                        model.executionContexts?.dispose();
                        model.dispose();
                    }
                });

                this.connectionPresentation.delete(page);

                // Note: this connection is not part of the data model, so we don't have to remove it from there.
                //       Instead it was cloned when the tab was created.
                await info.connection.close();
            }
        } else {
            index = documentTabs.findIndex((info: IDocumentTab) => {
                return info.dataModelEntry.id === tabId;
            });

            if (index > -1) {
                let newSelection = selectedPage;
                documentTabs.splice(index, 1);

                // Select a new page if the one that we close was also the active one.
                if (tabId === newSelection) {
                    // Standalone documents are always ordered last in the tab list. So first try to select the
                    // previous document tab or, if there are no more document tabs, select
                    // the last connection tab. If that's not possible either, select the overview tab.
                    if (index > 0) {
                        newSelection = documentTabs[index - 1].dataModelEntry.id;
                    } else if (connectionTabs.length > 0) {
                        newSelection = connectionTabs[connectionTabs.length - 1].dataModelEntry.id;
                    } else {
                        newSelection = "connections";
                    }
                }

                this.#documentDataModel.closeDocument(undefined, {
                    pageId: tabId,
                    id: tabId,
                });

                this.setState({ documentTabs, selectedPage: newSelection });
            }
        }

        return true;
    }

    /**
     * Similar to `removeTab`, but for shell session tabs.
     *
     * @param id The session id (tab id) of the shell session to remove.
     *
     * @returns A promise resolving to true, when the tab removal is finished.
     */
    private removeShellTab = async (id: string): Promise<boolean> => {
        const { selectedPage, shellSessionTabs } = this.state;

        // Remove all result data from the application DB.
        void ApplicationDB.removeDataByTabId(StoreType.Shell, id);

        const index = shellSessionTabs.findIndex((info) => {
            return info.dataModelEntry.id === id;
        });

        if (index > -1) {
            this.#documentDataModel.removeShellSession(undefined, id);

            const session = shellSessionTabs[index];
            await session.savedState.backend.closeShellSession();

            shellSessionTabs.splice(index, 1);
            requisitions.executeRemote("sessionRemoved", session.dataModelEntry.details);

            let newSelection = selectedPage;

            if (id === newSelection) {
                if (index > 0) {
                    newSelection = shellSessionTabs[index - 1].dataModelEntry.id;
                } else {
                    if (index >= shellSessionTabs.length - 1) {
                        newSelection = "sessions"; // The overview page cannot be closed.
                    } else {
                        newSelection = shellSessionTabs[index + 1].dataModelEntry.id;
                    }
                }
            }

            this.setState({ selectedPage: newSelection, shellSessionTabs });
        }

        return true;
    };

    /**
     * Triggered by the document outline drop down, to select one of the items in it.
     *
     * @param accept True if the selection happens by clicking (and hence closing) the drop down item.
     * @param ids A set of selected identifiers (in this case we always only have one).
     * @param payload The data model entry for the selected item.
     */
    private handleDropdownSelection = async (accept: boolean, ids: Set<string>, payload: unknown): Promise<void> => {
        const canClose = this.#currentTabRef.current ? (await this.#currentTabRef.current.canClose()) : true;
        if (!canClose) {
            return;
        }

        if (!payload) {
            this.showOverview();

            return;
        }

        const document = payload as LeafDocumentEntry | IOdmStandaloneDocumentEntry | IOdmShellSessionEntry;
        if (document.type === OdmEntityType.ShellSession) {
            void this.activateShellTab(document.id);
        } else {
            const tabId = document.type === OdmEntityType.StandaloneDocument ? document.id : document.parent!.id;

            // Activate the tab for the selected document.
            this.handleSelectTab(tabId);

            // Activate the document.
            this.handleSelectItem({
                tabId,
                document,
            });
        }
    };

    private addNewConsole = (e: MouseEvent | KeyboardEvent): void => {
        e.stopPropagation();

        if (this.#currentTabRef.current) {
            void this.#currentTabRef.current.canClose().then((canClose) => {
                if (!canClose) {
                    return;
                }
            });
        }

        void this.activateShellTab(uuid());
    };

    /**
     * This menu click handler is only used in the VS Code extension to offer a quick way to add new script files
     * or to open another notebook. Scripts created here are not stored in the user's script tree.
     *
     * @param props The properties of the item which was clicked.
     *
     * @returns Always true (to close the menu after the click).
     */
    private handleNewScriptClick = (props: IMenuItemProperties): boolean => {
        const { selectedPage, connectionTabs } = this.state;

        const page = connectionTabs.find((candidate) => {
            return candidate.dataModelEntry.id === selectedPage;
        });

        if (page) {
            switch (props.id) {
                case "addEditor": {
                    this.handleAddNotebook(selectedPage);

                    break;
                }

                case "addSQLScript": {
                    requisitions.executeRemote("createNewEditor", {
                        page: String(page.connection.details.id),
                        language: page.connection.details.dbType === DBType.MySQL ? "mysql" : "sql",
                    });

                    break;
                }

                case "addTSScript": {
                    requisitions.executeRemote("createNewEditor", {
                        page: String(page.connection.details.id),
                        language: "typescript",
                    });

                    break;
                }

                case "addJSScript": {
                    requisitions.executeRemote("createNewEditor", {
                        page: String(page.connection.details.id),
                        language: "javascript",
                    });

                    break;
                }

                default:
            }
        }

        return true;
    };

    private editorSaved = (_details: { id: string, newName: string, saved: boolean; }): Promise<boolean> => {
        // TODO: this is called when the host saves a document, to notify us about a name change. Handle that.
        return Promise.resolve(false);
    };

    private handleCloseDocument = async (details: { connectionId?: number, documentId: string; }): Promise<boolean> => {
        const { connectionTabs, documentTabs, shellSessionTabs } = this.state;

        const index = shellSessionTabs.findIndex((entry) => {
            return entry.dataModelEntry.id === details.documentId;
        });

        if (index > -1) {
            return this.removeShellTab(details.documentId);
        }

        const tab = connectionTabs.find((tab) => {
            return tab.connection.details.id === details.connectionId;
        });

        if (!tab) {
            const document = documentTabs.find((entry) => {
                return entry.dataModelEntry.id === details.documentId;
            });

            if (document) {
                return this.removeTab(details.documentId);
            }

            return Promise.resolve(false);
        }

        const connectionState = this.connectionPresentation.get(tab.dataModelEntry);
        if (connectionState) {
            // Check if the document can be closed, if it is the active one.
            if (connectionState.activeEntry === details.documentId) {
                const canClose = this.#currentTabRef.current ? (await this.#currentTabRef.current.canClose()) : true;
                if (!canClose) {
                    return true;
                }
            }

            const index = connectionState.documentStates.findIndex((state: IOpenDocumentState) => {
                return state.document.id === details.documentId;
            });

            if (index > -1) {
                const documentState = connectionState.documentStates[index];

                // Select another editor.
                if (index > 0) {
                    connectionState.activeEntry = connectionState.documentStates[index - 1].document.id;
                } else {
                    if (index < connectionState.documentStates.length - 1) {
                        connectionState.activeEntry = connectionState.documentStates[index + 1].document.id;
                    }
                }

                connectionState.documentStates.splice(index, 1);

                if (connectionState.documentStates.length === 0) {
                    // No editor left over -> close the connection. This will also send a remote notification.
                    return this.removeTab(tab.dataModelEntry.id);
                } else {
                    this.notifyRemoteEditorClose(tab.dataModelEntry.id, documentState.document.id,
                        tab.connection.details.id);
                    this.#documentDataModel.closeDocument(undefined, {
                        pageId: tab.dataModelEntry.id,
                        connectionId: tab.connection.details.id,
                        id: documentState.document.id,
                    });

                    this.forceUpdate();

                    return Promise.resolve(true);
                }
            }
        }

        return Promise.resolve(false);
    };

    private handleSelectDocument = async (details: { connectionId: number, documentId: string; }): Promise<boolean> => {
        let document;
        if (details.connectionId === -1) {
            document = this.#documentDataModel.findDocument(undefined, details.documentId);
        } else {
            document = this.#documentDataModel.findConnectionDocument(undefined, details.connectionId,
                details.documentId);
        }

        if (document) {
            await this.handleDocumentSelection(document);

            return true;
        } else {
            return this.showPage({ module: DBEditorModuleId, page: "connections" });
        }
    };

    private createNewEditor = (details: INewEditorRequest): Promise<boolean> => {
        const { selectedPage } = this.state;

        // Currently this is only used to create a new notebook.
        if (details.language === "msg") {
            this.handleAddNotebook(selectedPage);
        }

        return Promise.resolve(true);
    };

    /**
     * Activate the tab with the given id. Before switching the tab is checked if it can be closed,
     * that is, there are no pending changes in the editors.
     *
     * @param tabId The id of the tab to activate.
     */
    private handleSelectTab = (tabId: string): void => {
        const { selectedPage } = this.state;

        if (selectedPage !== tabId) {
            if (this.#currentTabRef.current) {
                // The current tab ref is only set for connection tabs.
                void this.#currentTabRef.current.canClose().then((canClose) => {
                    if (canClose) {
                        this.doSwitchTab(tabId);
                    }
                });
            } else {
                this.doSwitchTab(tabId);
            }
        }
    };

    /**
     * Here we know a new tab can be activated. This method does the actual switch.
     *
     * @param tabId The id of the tab to activate.
     */
    private doSwitchTab(tabId: string): void {
        const { connectionTabs, documentTabs, shellSessionTabs } = this.state;

        if (tabId === "connections") {
            this.showOverview();

            return;
        }

        // Now get the tab we want to switch to.
        const tab = connectionTabs.find((entry) => {
            return entry.dataModelEntry.id === tabId;
        });

        if (tab) {
            this.setState({ selectedPage: tabId });

            requisitions.executeRemote("selectConnectionTab", { connectionId: tab.connection.details.id });
        } else {
            const docTab = documentTabs.find((entry) => {
                return entry.dataModelEntry.id === tabId;
            });

            if (docTab) {
                this.setState({ selectedPage: docTab.dataModelEntry.id });
            } else {
                const shellTab = shellSessionTabs.find((entry) => {
                    return entry.dataModelEntry.id === tabId;
                });

                if (shellTab) {
                    this.setState({ selectedPage: shellTab.dataModelEntry.id });
                }
            }
        }
    }

    /**
     * This method creates a notebook and notifies the host about it.
     *
     * @param tabId The id of the tab to add the notebook to.
     *
     * @returns A unique id for the new editor, if one was created.
     */
    private handleAddNotebook = (tabId: string): string | undefined => {
        const { connectionTabs } = this.state;

        const tab = connectionTabs.find((entry) => {
            return entry.dataModelEntry.id === tabId;
        });

        if (tab) { // Sanity check. Should always succeed.
            const connectionState = this.connectionPresentation.get(tab.dataModelEntry);
            if (connectionState) {
                const connection = tab.connection;
                const model = this.createEditorModel(connection.backend, "", "msg", connection.details.version!,
                    connection.details.sqlMode!, connection.currentSchema);

                const editorId = uuid();
                const caption = `DB Notebook ${++this.#documentCounter}`;
                const newState: Mutable<Partial<IOpenDocumentState>> = {
                    state: {
                        model,
                        viewState: null,
                        options: defaultEditorOptions,
                    },
                    currentVersion: model.getVersionId(),
                };
                connectionState.documentStates.push(newState as IOpenDocumentState);
                connectionState.activeEntry = editorId;

                const document = this.#documentDataModel.openDocument(undefined, {
                    type: OdmEntityType.Notebook,
                    parameters: {
                        pageId: tabId,
                        id: editorId,
                        connection: connection.details,
                        caption,
                    },
                });

                if (document) {
                    newState.document = document;
                }

                this.notifyRemoteEditorOpen(tabId, document as LeafDocumentEntry, connection.details);
                this.forceUpdate();

                return editorId;
            }
        }
    };

    /**
     * Removes a single editor on a connection tab.
     *
     * @param tabId  The id of the tab in which the editor is located.
     * @param documentId The id of the document to remove.
     * @param doUpdate A flag telling if re-rendering is needed.
     */
    private handleRemoveDocument = (tabId: string, documentId: string, doUpdate = true): void => {
        const { connectionTabs } = this.state;

        const tab = connectionTabs.find((entry) => {
            return entry.dataModelEntry.id === tabId;
        });

        if (tab) {
            const connectionState = this.connectionPresentation.get(tab?.dataModelEntry);
            if (connectionState) {
                const index = connectionState.documentStates.findIndex((editor: IOpenDocumentState) => {
                    return editor.document.id === documentId;
                });

                if (index > -1) {
                    if (connectionState.activeEntry === documentId) {
                        // Select another editor if we're just removing the selected one.
                        if (index > 0) {
                            connectionState.activeEntry = connectionState.documentStates[index - 1].document.id;
                        } else {
                            if (index < connectionState.documentStates.length - 1) {
                                connectionState.activeEntry = connectionState.documentStates[index + 1].document.id;
                            }
                        }
                    }

                    connectionState.documentStates.splice(index, 1);

                    this.notifyRemoteEditorClose(tabId, documentId, tab.connection.details.id);

                    const connection = tab.connection;
                    this.#documentDataModel.closeDocument(undefined, {
                        pageId: tabId,
                        connectionId: connection.details.id,
                        id: documentId,
                    });

                    if (connectionState.documentStates.length === 0) {
                        // Add the default editor, if the user just removed the last editor.
                        const useNotebook = Settings.get("dbEditor.defaultEditor", "notebook") === "notebook";
                        const language = useNotebook ? "msg" : "mysql";
                        const model = this.createEditorModel(connection.backend, "", language,
                            connection.details.version!, connection.details.sqlMode!, connection.currentSchema);

                        const entryId = uuid();
                        const editorCaption = `DB Notebook ${++this.#documentCounter}`;
                        const type = useNotebook ? OdmEntityType.Notebook : OdmEntityType.Script;

                        const document = this.#documentDataModel.openDocument(undefined, {
                            type,
                            parameters: {
                                pageId: tabId,
                                id: entryId,
                                connection: connection.details,
                                caption: editorCaption,
                                language,
                            },
                        });

                        if (document) {
                            const newState: IOpenDocumentState = {
                                state: {
                                    model,
                                    viewState: null,
                                    options: defaultEditorOptions,
                                },
                                currentVersion: model.getVersionId(),
                                document,
                            };

                            connectionState.documentStates.push(newState);
                            connectionState.activeEntry = entryId;

                            this.notifyRemoteEditorOpen(tabId, document);
                        }
                    }

                    if (doUpdate) {
                        this.forceUpdate();
                    }
                }
            }
        }
    };

    private handleLoadScript = (tabId: string, editorId: string, content: string): void => {
        const { connectionTabs } = this.state;
        const tab = connectionTabs.find((entry) => {
            return entry.dataModelEntry.id === tabId;
        });

        if (tab) {
            const connectionState = this.connectionPresentation.get(tab.dataModelEntry);
            if (connectionState) {
                const editor = connectionState.documentStates.find((candidate: IOpenDocumentState) => {
                    return candidate.document.id === editorId;
                });

                editor?.state?.model?.setValue(content);
            }
        }
    };

    /**
     * Activates a specific editor on a connection tab or creates new tabs for special pages, like
     * admin pages or external scripts.
     *
     * @param details The details of the selected entry.
     */
    private handleSelectItem = (details: ISelectItemDetails): void => {
        const { connectionTabs } = this.state;

        if (details.document.type === OdmEntityType.StandaloneDocument) {
            this.doSwitchTab(details.document.id);

            return;
        }

        const tab = connectionTabs.find((entry) => {
            return entry.dataModelEntry.id === details.tabId;
        });

        const connectionState = tab ? this.connectionPresentation.get(tab.dataModelEntry) : undefined;
        if (connectionState) {
            // Check if we have an open document with the new id
            // (administration pages like server status count here too).
            const newEditor = connectionState.documentStates.find((candidate: IOpenDocumentState) => {
                return candidate.document.id === details.document.id;
            });

            let documentId: string = "";
            if (newEditor) {
                documentId = newEditor.document.id;
            } else {
                documentId = details.document.id;

                // Must be an administration page or an external script then.
                if (details.document.type === OdmEntityType.Script) {
                    // External scripts come with their full content.
                    if (details.content !== undefined) {
                        const newState = this.addEditorFromScript(details.tabId, tab!.connection,
                            details.document, details.content);
                        connectionState.documentStates.push(newState);
                    }
                } else {
                    const document = details.document as IOdmAdminEntry;
                    const newState: IOpenDocumentState = {
                        document: details.document,
                        currentVersion: 0,
                    };

                    connectionState.documentStates.push(newState);

                    this.notifyRemoteEditorOpen(details.tabId, document, document.parent?.details);
                }
            }

            if (tab?.dataModelEntry) {
                connectionState.activeEntry = documentId;
                requisitions.executeRemote("selectDocument", { connectionId: tab.connection.details.id, documentId });

                this.forceUpdate();
            }
        } else if (tab) {
            // Even if the active page does not change, we have to notify the remote side.
            // Otherwise there's no notification when the user switches between multiple tabs.
            requisitions.executeRemote("selectDocument",
                { connectionId: tab.connection.details.id, documentId: details.document.id });
        }
    };

    /**
     * Helper method to create a new editor entry from a script entry.
     *
     * @param tabId The id of the connection tab.
     * @param connection The data model entry for the connection in which to add the editor.
     * @param script The script from which we create the editor.
     * @param content The script's content.
     *
     * @returns The new editor state.
     */
    private addEditorFromScript(tabId: string, connection: ICdmConnectionEntry, script: IOdmScriptEntry,
        content: string): IOpenDocumentState {
        const model = this.createEditorModel(connection.backend, content, script.language,
            connection.details.version!, connection.details.sqlMode!, connection.currentSchema);

        const newState: IOpenDocumentState = {
            document: script,
            state: {
                model,
                viewState: null,
                options: defaultEditorOptions,
            },
            currentVersion: model.getVersionId(),
        };

        this.notifyRemoteEditorOpen(tabId, script, connection.details);

        return newState;
    }

    private handleEditorRename = (tabId: string, editorId: string, newCaption: string): void => {
        const { connectionTabs } = this.state;
        const tab = connectionTabs.find((entry) => {
            return entry.dataModelEntry.id === tabId;
        });

        if (!tab) {
            return;
        }

        const connectionState = this.connectionPresentation.get(tab.dataModelEntry);
        if (newCaption && connectionState) {
            let needsUpdate = false;
            const state = connectionState.documentStates.find((candidate: IOpenDocumentState) => {
                return candidate.document.id === editorId;
            });

            if (state) {
                state.document.caption = newCaption;
                needsUpdate = true;
            }

            if (needsUpdate) {
                this.forceUpdate();
            }
        }
    };

    /**
     * Handles sidebar menu actions for the document tree.
     *
     * @param command The command to execute.
     * @param entry The data model entry for which to execute the command.
     *
     * @returns A promise which resolves to true, except when the user cancels the operation.
     */
    private handleSideBarDocumentCommand = async (command: Command,
        entry: OpenDocumentDataModelEntry): Promise<ISideBarCommandResult> => {

        const canClose = this.#currentTabRef.current ? (await this.#currentTabRef.current.canClose()) : true;
        if (!canClose) {
            return { success: false };
        }

        const pageEntry = entry as IOdmConnectionPageEntry;
        switch (command.command) {
            case "msg.loadScriptFromDisk": {
                await this.loadScriptFromDisk(pageEntry.details);

                break;
            }

            case "msg.addScript":
            case "msg.newScriptMysql":
            case "msg.newScriptSqlite": {
                await this.createAndSelectScriptDocument(pageEntry.details, `Script ${++this.#documentCounter}`,
                    pageEntry.details.dbType === DBType.MySQL ? "mysql" : "sql", "");

                break;
            }

            case "msg.newScriptJs":
            case "msg.newScriptTs": {
                await this.createAndSelectScriptDocument(pageEntry.details, `Script ${++this.#documentCounter}`,
                    command.command === "msg.newScriptTs" ? "typescript" : "javascript", "");

                break;
            }

            case "msg.newSessionUsingConnection": {
                if (entry.type === OdmEntityType.ConnectionPage) {
                    await this.activateShellTab(uuid(), entry.details.id, entry.details.caption);
                }

                break;
            }

            default: {
                return this.#sidebarCommandHandler.handleDocumentCommand(command, entry);
            }
        }

        return { success: true };
    };

    /**
     * Handles sidebar menu actions for the connection tree.
     *
     * @param command The command to execute.
     * @param entry The data model entry for which to execute the command.
     * @param qualifiedName Optionally, the qualified name of the entry. Used for DB object related actions.
     *
     * @returns A promise which resolves to true, except when the user cancels the operation.
     */
    private handleSideBarConnectionCommand = async (command: Command, entry?: ConnectionDataModelEntry,
        qualifiedName?: QualifiedName): Promise<ISideBarCommandResult> => {
        const { connectionTabs } = this.state;

        const canClose = this.#currentTabRef.current ? (await this.#currentTabRef.current.canClose()) : true;
        if (!canClose) {
            return { success: false };
        }

        const connection = entry?.connection;
        const connectionId = connection?.details.id;

        switch (command.command) {
            case "msg.openConnection": {
                if (connection) {
                    await this.showPage({ module: DBEditorModuleId, page: String(connectionId) });
                }

                break;
            }

            case "msg.loadScriptFromDisk": {
                if (connection) {
                    await this.loadScriptFromDisk(connection.details);
                }

                break;
            }

            case "setCurrentSchemaMenuItem": {
                if (connection) {
                    const tab = connectionTabs.find((tab) => {
                        return tab.connection.details.id === connection.details.id;
                    });

                    if (tab && qualifiedName) {
                        await this.setCurrentSchema({
                            id: tab.dataModelEntry.id, connectionId: connection.details.id, schema: qualifiedName.name!,
                        });
                    }
                }

                break;
            }

            case "msg.newSessionUsingConnection": {
                await this.activateShellTab(uuid(), connection?.details.id, connection?.details.caption);

                break;
            }

            case "addConsole": {
                void this.activateShellTab(uuid());

                break;
            }

            default: {
                return this.#sidebarCommandHandler.handleConnectionTreeCommand(command, entry, qualifiedName);
            }
        }

        return { success: true };
    };

    private handleSideBarOciCommand = async (command: Command,
        entry: OciDataModelEntry): Promise<ISideBarCommandResult> => {
        const { documentTabs } = this.state;

        const showNewSimpleEditor = (name: string, text: string, language: EditorLanguage): void => {
            const model: ICodeEditorModel = Object.assign(Monaco.createModel(text, "json"), {
                executionContexts: new ExecutionContexts(),
                editorMode: CodeEditorMode.Standard,
            });

            const id = uuid();
            const document = this.#documentDataModel.openDocument(undefined, {
                type: OdmEntityType.StandaloneDocument,
                parameters: { id, caption: name, language },
            });

            if (document) {
                documentTabs.push({
                    dataModelEntry: document,
                    savedState: {
                        model,
                        viewState: null,
                        options: defaultEditorOptions,
                    },
                });

                this.setState({ documentTabs, selectedPage: document.id });

                this.notifyRemoteEditorOpen(document.id, document);
            }
        };

        let success = false;
        switch (command.command) {
            case "msg.mds.getProfileInfo": {
                const profile = entry as IOciDmProfile;
                const text = JSON.stringify(profile.profileData, null, 4);
                const name = `${profile.profileData.profile.toString()} Info.json`;
                showNewSimpleEditor(name, text, "json");
                success = true;

                break;
            }

            case "msg.mds.getCompartmentInfo": {
                const compartment = entry as IOciDmCompartment;
                const text = JSON.stringify(compartment.compartmentDetails, null, 4);
                const name = `${compartment.compartmentDetails.name} Info.json`;
                showNewSimpleEditor(name, text, "json");
                success = true;

                break;
            }

            case "msg.mds.getDbSystemInfo": {
                const dbSystem = entry as IOciDmDbSystem;
                const text = JSON.stringify(dbSystem.details, null, 4);
                const name = `${dbSystem.details.displayName} Info.json`;
                showNewSimpleEditor(name, text, "json");

                break;
            }

            case "msg.mds.getComputeInstance": {
                const computeInstance = entry as IOciDmComputeInstance;
                const text = JSON.stringify(computeInstance.instance, null, 4);
                const name = `${computeInstance.instance.displayName} Info.json`;
                showNewSimpleEditor(name, text, "json");

                break;
            }

            case "msg.mds.getBastion": {
                const bastion = entry as IOciDmBastion;
                const text = JSON.stringify(bastion.summary, null, 4);
                const name = `${bastion.summary.name} Info.json`;
                showNewSimpleEditor(name, text, "json");

                break;
            }

            default: {
                return this.#sidebarCommandHandler.handleOciCommand(command, entry);
            }
        }

        return { success };
    };

    private async loadScriptFromDisk(connection: IConnectionDetails): Promise<void> {
        const files = await selectFile([".sql"], false);
        if (files && files.length > 0) {
            const file = files[0];
            const content = await loadFileAsText(file);

            await this.createAndSelectScriptDocument(connection, file.name,
                connection.dbType === DBType.MySQL ? "mysql" : "sql", content);
        }
    }

    /**
     * Creates a new script document and selects it.
     *
     * @param connection The connection to use for the new document. There might already be a connection tab for it.
     * @param caption The caption in the document tree.
     * @param language The language of the script.
     * @param content The initial content of the script.
     */
    private async createAndSelectScriptDocument(connection: IConnectionDetails, caption: string,
        language: EditorLanguage, content: string): Promise<void> {
        const { connectionTabs } = this.state;

        // Make sure we have a tab open for the connection.
        await this.showPage({ module: DBEditorModuleId, page: String(connection.id) });

        // At this point we should always find the tab.
        const tab = connectionTabs.find((tab) => {
            return tab.connection.details.id === connection.id;
        });

        if (tab) {
            const document = this.#documentDataModel.openDocument(undefined, {
                type: OdmEntityType.Script,
                parameters: {
                    pageId: tab.dataModelEntry.id,
                    id: uuid(),
                    connection,
                    caption,
                    language,
                },
            });

            if (document) {
                this.handleSelectItem({
                    document,
                    tabId: tab.dataModelEntry.id,
                    content,
                });
            }
        }
    }

    /**
     * Selects the shell tab with the given session id. If none exists, a new tab is created.
     *
     * @param sessionId The id of the session to open.
     * @param connectionId if given open this connection on start of the session, if we have to create a new one.
     * @param caption The caption of the tab.
     */
    private async activateShellTab(sessionId: string, connectionId?: number, caption?: string): Promise<void> {
        const { shellSessionTabs } = this.state;

        const existing = shellSessionTabs.find((info) => {
            return info.dataModelEntry.details.sessionId === sessionId;
        });

        if (existing) {
            this.setState({ selectedPage: sessionId });
            requisitions.executeRemote("selectDocument", { connectionId: connectionId ?? -1, documentId: sessionId });
        } else {
            this.showProgress();
            const backend = new ShellInterfaceShellSession();

            this.setProgressMessage("Starting shell session...");
            const requestId = uuid();
            try {
                await backend.startShellSession(sessionId, connectionId, undefined, requestId,
                    (response) => {
                        if (!ShellPromptHandler.handleShellPrompt(response.result, requestId, backend)) {
                            this.setProgressMessage("Loading ...");
                        }
                    });

                // TODO: get current schema, if a connection is given.
                const currentSchema = "";

                // TODO: we need server information for code completion.
                const versionString = Settings.get("editor.dbVersion", "8.0.24");
                const serverVersion = parseVersion(versionString);
                const serverEdition = "";
                const sqlMode = Settings.get("editor.sqlMode", "");

                const model = this.createSessionEditorModel(backend, "", "msg", serverVersion, sqlMode, currentSchema);

                caption = caption ? `Session to ${caption}` : `Session ${++this.#sessionCounter}`;
                const document = this.#documentDataModel.addShellSession(undefined, {
                    sessionId,
                    caption,
                    dbConnectionId: connectionId,
                });

                const sessionState: IShellTabPersistentState = {
                    dataModelEntry: document,
                    state: {
                        model,
                        viewState: null,
                        options: defaultEditorOptions,
                    },
                    backend,
                    serverVersion,
                    serverEdition,
                    sqlMode,
                };

                shellSessionTabs.push({ dataModelEntry: document, savedState: sessionState });

                this.hideProgress(false);
                this.setState({ shellSessionTabs, selectedPage: document.id, loading: false });

                requisitions.executeRemote("sessionAdded", document.details);
            } catch (error) {
                const message = convertErrorToString(error);
                void ui.showErrorNotification("Shell Session Error: " + message);
            }

            this.hideProgress(true);
        }
    }

    private handleGraphDataChange = (tabId: string, data: ISavedGraphData) => {
        const { connectionTabs } = this.state;

        const tab = connectionTabs.find((entry) => {
            return entry.dataModelEntry.id === tabId;
        });

        if (!tab) {
            return;
        }

        const connectionState = this.connectionPresentation.get(tab.dataModelEntry);
        if (connectionState) {
            connectionState.graphData = data;
        }

        this.forceUpdate();
    };

    private onChatOptionsChange = (tabId: string, data: Partial<IChatOptionsState>): void => {
        const { connectionTabs } = this.state;

        const tab = connectionTabs.find((entry) => {
            return entry.dataModelEntry.id === tabId;
        });

        if (!tab) {
            return;
        }

        const connectionState = this.connectionPresentation.get(tab.dataModelEntry);
        if (connectionState) {
            connectionState.chatOptionsState = {
                ...connectionState.chatOptionsState,
                ...data,
            };
        }

        this.forceUpdate();
    };

    /**
     * Creates the standard model used by DB code editors. Each editor has an own model, which carries additional
     * information required by the editors.
     *
     * @param backend The interface for the current shell module session, used for running code and editor assistance.
     * @param text The initial content of the model.
     * @param language The code language used in the model.
     * @param serverVersion The version of the connected server (relevant only for SQL languages).
     * @param sqlMode The current SQL mode of the server (relevant only for MySQL).
     * @param currentSchema The current default schema.
     *
     * @returns The new model.
     */
    private createEditorModel(backend: ShellInterfaceSqlEditor, text: string, language: string,
        serverVersion: number, sqlMode: string, currentSchema: string): ICodeEditorModel {
        const model: ICodeEditorModel = Object.assign(Monaco.createModel(text, language), {
            executionContexts: new ExecutionContexts({
                store: StoreType.DbEditor,
                dbVersion: serverVersion,
                sqlMode,
                currentSchema,
                runUpdates: this.sendSqlUpdatesFromModel.bind(this, backend),
            }),
            symbols: new DynamicSymbolTable(backend, "db symbols", { allowDuplicateSymbols: true }),
            editorMode: CodeEditorMode.Standard,
        });

        if (model.getEndOfLineSequence() !== Monaco.EndOfLineSequence.LF) {
            model.setEOL(Monaco.EndOfLineSequence.LF);
        } else {
            model.setValue(text);
        }

        return model;
    }

    /**
     * Creates the shell editor model which differs from standard editor models.
     *
     * @param session The interface to interact with the shell (e.g. for code completion).
     * @param text The initial content of the model.
     * @param language The initial code language used in the model.
     * @param serverVersion The version of the connected server (relevant only for SQL languages).
     * @param sqlMode The current SQL mode of the server (relevant only for MySQL).
     * @param currentSchema The current default schema.
     *
     * @returns The new model.
     */
    private createSessionEditorModel(session: ShellInterfaceShellSession, text: string, language: string,
        serverVersion: number, sqlMode: string, currentSchema: string): IShellEditorModel {
        const model: IShellEditorModel = Object.assign(Monaco.createModel(text, language), {
            executionContexts: new ExecutionContexts({
                store: StoreType.Shell,
                dbVersion: serverVersion,
                sqlMode,
                currentSchema,
                runUpdates: this.sendSessionSqlUpdatesFromModel.bind(this, session),
            }),

            // Create a default symbol table with no DB connection. This will be replaced in ShellTab, depending
            // on the connection the user opens.
            symbols: new DynamicSymbolTable(undefined, "db symbols", { allowDuplicateSymbols: true }),
            editorMode: CodeEditorMode.Terminal,
            session,
        });


        if (model.getEndOfLineSequence() !== Monaco.EndOfLineSequence.LF) {
            model.setEOL(Monaco.EndOfLineSequence.LF);
        } else {
            model.setValue(text);
        }

        return model;
    }

    private setProgressMessage = (message: string): void => {
        this.setState({ progressMessage: message });
    };

    private showProgress = (): void => {
        this.#pendingProgress = setTimeout(() => {
            const { selectedPage } = this.state;

            this.setState({ loading: true, lastSelectedPage: selectedPage });
        }, 500);
    };

    private hideProgress = (reRender: boolean): void => {
        if (this.#pendingProgress) {
            clearTimeout(this.#pendingProgress);
            this.#pendingProgress = null;

            if (reRender) {
                this.setState({ loading: false });
            }
        }
    };

    private handleSaveExplorerState = (state: Map<string, IDBEditorSideBarSectionState>): void => {
        this.setState({ sidebarState: state });
    };

    private handleDocumentSelection = async (entry: OpenDocumentDataModelEntry): Promise<void> => {
        const canClose = this.#currentTabRef.current ? (await this.#currentTabRef.current.canClose()) : true;
        if (!canClose) {
            return;
        }

        switch (entry.type) {
            case OdmEntityType.Overview: {
                this.showOverview();

                break;
            }

            case OdmEntityType.AdminPage:
            case OdmEntityType.Notebook:
            case OdmEntityType.Script: {
                if (entry.parent) {
                    const page = entry.parent;
                    this.handleSelectTab(page.id);
                    this.handleSelectItem({
                        tabId: page.id,
                        document: entry,
                    });
                }

                break;
            }


            case OdmEntityType.ShellSession: {
                void this.activateShellTab(entry.id);

                break;
            }

            case OdmEntityType.StandaloneDocument: {
                const { documentTabs } = this.state;

                const tab = documentTabs.find((info) => {
                    return info.dataModelEntry.id === entry.id;
                });

                if (tab) {
                    this.setState({ selectedPage: entry.id });
                }

                break;
            }

            default:
        }
    };

    /**
     * Triggered when an item in the connection tree is selected by the user.
     *
     * @param entry The entry that was selected.
     */
    private handleConnectionEntrySelection = async (entry: ConnectionDataModelEntry): Promise<void> => {
        const { connectionTabs } = this.state;


        switch (entry.type) {
            case CdmEntityType.AdminPage: {
                const pageId = String(entry.connection.details.id);

                const canClose = this.#currentTabRef.current ? (await this.#currentTabRef.current.canClose()) : true;
                if (!canClose) {
                    return;
                }

                await this.showPage({ module: DBEditorModuleId, page: pageId });

                const tab = connectionTabs.find((tab) => {
                    return tab.connection.details.id === entry.parent.connection.details.id;
                });

                const document = this.#documentDataModel.openDocument(undefined, {
                    type: OdmEntityType.AdminPage,
                    parameters: {
                        id: entry.id,
                        pageId,
                        connection: entry.parent.connection.details,
                        caption: entry.caption,
                        pageType: entry.pageType,
                    },
                });

                if (document) {
                    this.handleSelectItem({ tabId: tab!.dataModelEntry.id, document });
                }

                break;
            }

            default:
        }
    };

    /**
     * Sends a notification to the host (if any) that an editor has been opened.
     *
     * @param tabId The id of the tab in which the editor is located.
     * @param document The document that was opened.
     * @param connection The connection for which the document was opened. Can be unassigned for standalone documents.
     */
    private notifyRemoteEditorOpen(tabId: string, document: OpenDocumentDataModelEntry,
        connection?: IConnectionDetails) {
        const language = document.type === OdmEntityType.Script ? document.language : undefined;
        const pageType = document.type === OdmEntityType.AdminPage ? document.pageType : undefined;

        requisitions.executeRemote("documentOpened", {
            pageId: tabId,
            connection,
            documentDetails: {
                id: document.id,
                caption: document.caption,
                type: document.type,
                language,
                pageType,
            },
        });
    }

    /**
     * Sends a notification to the host (if any) that an editor has been closed.
     *
     * @param tabId The id of the tab in which the editor was located.
     * @param documentId The id of the editor to close. If not given, the tab itself is closed.
     * @param connectionId If set this is the id of the connection used by the document.
     */
    private notifyRemoteEditorClose(tabId: string, documentId?: string, connectionId?: number) {
        requisitions.executeRemote("documentClosed", {
            pageId: tabId,
            id: documentId,
            connectionId,
        });
    }

    private sendSqlUpdatesFromModel = async (backend: ShellInterfaceSqlEditor,
        updates: string[]): Promise<ISqlUpdateResult> => {

        let lastIndex = 0;
        let rowCount = 0;
        try {
            await backend.startTransaction();
            for (; lastIndex < updates.length; ++lastIndex) {
                const update = updates[lastIndex];
                const result = await backend.execute(update);
                rowCount += result?.rowsAffected ?? 0;
            }
            await backend.commitTransaction();

            void ui.showInformationNotification("Changes committed successfully.");

            return { affectedRows: rowCount, errors: [] };
        } catch (reason) {
            await backend.rollbackTransaction();
            if (reason instanceof Error) {
                const errors: string[] = [];
                errors[lastIndex] = reason.message; // Set the error for the query that was last executed.

                return { affectedRows: rowCount, errors };
            }

            throw reason;
        }
    };

    private sendSessionSqlUpdatesFromModel = async (session: ShellInterfaceShellSession,
        updates: string[]): Promise<ISqlUpdateResult> => {

        let lastIndex = 0;
        const rowCount = 0;
        try {
            await session.execute("start transaction");
            for (; lastIndex < updates.length; ++lastIndex) {
                const update = updates[lastIndex];
                await session.execute(update);

                // TODO: we need to get the number of affected rows from the result.
                // rowCount += result?.rowsAffected ?? 0;
            }
            await session.execute("commit");

            return { affectedRows: rowCount, errors: [] };
        } catch (reason) {
            await session.execute("rollback");
            if (reason instanceof Error) {
                const errors: string[] = [];
                errors[lastIndex] = reason.message; // Set the error for the query that was last executed.

                return { affectedRows: rowCount, errors };
            }

            throw reason;
        }
    };

    private handleHelpCommand = (command: string, language: EditorLanguage): string | undefined => {
        switch (language) {
            case "javascript": {
                return `The DB Notebook's interactive prompt is currently running in JavaScript mode.
Execute "\\sql" to switch to SQL mode, "\\ts" to switch to TypeScript mode.

GLOBAL FUNCTIONS
    - \`print(value: any): void\`
      Send a value to the output area.
    - \`runSql(code: string, callback?: (res: IResultSetRow[]) => void), params?: unknown): void\`
      Run the given query.
    - \`function runSqlIterative(code: string, callback?: (res: IResultSetData) => void, params?: unknown): void\`
      Run the given query and process the rows iteratively.
`;
            }

            case "typescript": {
                return `The DB Notebook's interactive prompt is currently running in TypeScript mode.
Execute "\\sql" to switch to SQL mode, "\\js" to switch to JavaScript mode.

GLOBAL FUNCTIONS
    - \`print(value: unknown): void\`
      Send a value to the output area.
    - \`runSql(code: string, callback?: (res: IResultSetRow[]) => void), params?: unknown[]): void\`
      Run the given query.
    - \`function runSqlIterative(code: string, callback?: (res: IResultSetData) => void, params?: unknown[]): void\`
      Run the given query and process the rows iteratively.
`;
            }

            case "mysql": {
                return `The DB Notebook's interactive prompt is currently running in SQL mode.
Execute "\\js" to switch to JavaScript mode, "\\ts" to switch to TypeScript mode.

Use ? as placeholders, provide values in comments.
EXAMPLES
    SELECT * FROM user
    WHERE name = ? /*=mike*/`;
            }

            default:
        }
    };
}
