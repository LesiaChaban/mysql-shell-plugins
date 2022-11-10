/*
 * Copyright (c) 2021, 2022, Oracle and/or its affiliates.
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

import React from "react";

import { IShellPromptValues } from "../../communication/";

import {
    Breadcrumb, Component, IComponentProperties, IComponentState, IMenuItemProperties, Label, Menu, MenuItem,
} from "../../components/ui";
import { requisitions } from "../../supplement/Requisitions";

export interface IShellPromptProperties extends IComponentProperties {
    values: IShellPromptValues;

    getSchemas: () => Promise<string[]>;
    onSelectSchema?: (schema: string) => void;
}

export interface IShellPromptState extends IComponentState {
    values: IShellPromptValues;
    schemaNames: string[];
}

// These values represent a special symbol in the MySQL font.
enum TypeSymbol {
    Server = "\ue895",
    Schema = "\ue894",
    SSL = "\ue0a2",
}

export class ShellPrompt extends Component<IShellPromptProperties, IShellPromptState> {

    private schemaMenuRef = React.createRef<Menu>();

    public constructor(props: IShellPromptProperties) {
        super(props);

        this.state = {
            values: props.values,
            schemaNames: [],
        };
    }

    public static getDerivedStateFromProps(props: IShellPromptProperties): Partial<IShellPromptState> {
        return {
            values: props.values,
        };
    }

    public componentDidMount(): void {
        requisitions.register("updateShellPrompt", this.updateShellPrompt);
    }

    public componentWillUnmount(): void {
        requisitions.unregister("updateShellPrompt", this.updateShellPrompt);
    }

    public render(): React.ReactNode {
        const { values, schemaNames } = this.state;

        const className = this.getEffectiveClassNames(["shellPrompt"]);

        const items: React.ReactElement[] = [];
        if (values.promptDescriptor) {
            if (!values.promptDescriptor.host) {
                // Not connected yet.
                items.push(
                    <Label
                        key="server"
                        id="server"
                        className="shellPromptItem"
                        caption="not connected"
                        data-tooltip="The session is not connected to a MySQL server"
                    />,
                );
            } else {
                let serverText = values.promptDescriptor.host;
                let tooltip = "Connection to server " + values.promptDescriptor.host;
                if (values.promptDescriptor.socket) {
                    serverText = "localhost";
                }

                if (values.promptDescriptor.port) {
                    serverText += `:${values.promptDescriptor.port}`;
                    tooltip += ` at port ${values.promptDescriptor.port}`;
                }

                if (values.promptDescriptor.session === "x") {
                    serverText += "+";
                    tooltip += ", using the X protocol";
                } else {
                    tooltip += ", using the classic protocol";
                }

                if (values.promptDescriptor.ssl === "SSL") {
                    serverText += ` ${TypeSymbol.SSL}`;
                    tooltip += " (encrypted)";
                }

                items.push(
                    <Label
                        key="server"
                        id="server"
                        className="shellPromptItem"
                        caption={`${TypeSymbol.Server} ${serverText}`}
                        data-tooltip={tooltip}
                    />,
                );

                const schemaText = values.promptDescriptor.schema ?? "no schema selected";
                items.push(
                    <Label
                        key="schema"
                        id="schema"
                        className="shellPromptItem"
                        caption={`${TypeSymbol.Schema} ${schemaText}`}
                        onClick={this.handleSchemaSectionClick}
                    />,
                );
            }
        }

        const menuItems = schemaNames.map((schema) => {
            return <MenuItem key={schema} caption={TypeSymbol.Schema + " " + schema} />;
        });

        return (
            <>
                <Breadcrumb className={className}>
                    {items}
                </Breadcrumb>
                <Menu
                    className="shellPromptSchemaMenu"
                    ref={this.schemaMenuRef}
                    onItemClick={this.handleSchemaItemClick}
                >
                    {menuItems}
                </Menu>
            </>
        );
    }

    private updateShellPrompt = (values: IShellPromptValues): Promise<boolean> => {
        return new Promise((resolve) => {
            this.setState({ values }, () => { resolve(true); });
        });
    };

    private handleSchemaSectionClick = (e: React.SyntheticEvent): void => {
        const { getSchemas } = this.props;

        e.stopPropagation();
        void getSchemas?.().then((schemaNames) => {
            this.setState({ schemaNames }, () => {
                const clientRect = (e.target as Element).getBoundingClientRect();
                const targetRect = new DOMRect(clientRect.x, clientRect.y + clientRect.height, 1, 1);
                this.schemaMenuRef.current?.open(targetRect, false);
            });
        });
    };

    private handleSchemaItemClick = (e: React.MouseEvent, props: IMenuItemProperties): boolean => {
        const { onSelectSchema } = this.props;
        onSelectSchema?.(props.caption?.substr(2) ?? "");

        return true;
    };
}
