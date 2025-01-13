/*
 * Copyright (c) 2024, 2025, Oracle and/or its affiliates.
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

import type { IUILayer } from "../../../app-logic/UILayer.js";
import type { IStatusBarItem } from "../../../components/ui/Statusbar/StatusBarItem.js";

const statusBarItemMock: IStatusBarItem = {
    id: "mock",
    alignment: 1,
    text: "mock",
    tooltip: "mock",
    color: "mock",
    command: "mock",
    visible: true,
    show: jest.fn(),
    hide: jest.fn(),
    dispose: jest.fn(),
};

export const uiLayerMock: IUILayer = {
    showInformationNotification: jest.fn().mockReturnValue(Promise.resolve(undefined)),
    showWarningNotification: jest.fn().mockReturnValue(Promise.resolve(undefined)),
    showErrorNotification: jest.fn().mockReturnValue(Promise.resolve(undefined)),
    createStatusBarItem: jest.fn().mockReturnValue(statusBarItemMock),
    setStatusBarMessage: jest.fn(),
    confirm: jest.fn(),
    requestPassword: jest.fn().mockReturnValue(Promise.resolve(undefined)),
};
