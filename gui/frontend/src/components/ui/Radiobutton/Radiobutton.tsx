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

import "./Radiobutton.css";

import { createRef, ComponentChild } from "preact";

import { CheckState } from "../Checkbox/Checkbox.js";
import { IComponentProperties, ComponentBase, MouseEventType } from "../Component/ComponentBase.js";
import { KeyboardKeys } from "../../../utilities/helpers.js";

export interface IRadiobuttonProperties extends IComponentProperties {
    checkState?: CheckState;
    disabled?: boolean;
    caption?: string;
    name?: string;

    onChange?: (checkState: CheckState, props: IRadiobuttonProperties) => void;
}

export class Radiobutton extends ComponentBase<IRadiobuttonProperties> {

    public static override defaultProps = {
        checkState: CheckState?.Unchecked,
        disabled: false,
        caption: "Radiobutton",
    };

    private inputRef = createRef<HTMLInputElement>();

    public constructor(props: IRadiobuttonProperties) {
        super(props);

        this.addHandledProperties("checkState", "caption", "name", "disabled");
        this.connectEvents("onClick");
    }

    public override componentDidMount(): void {
        // istanbul ignore else
        if (this.inputRef.current) {
            const { checkState } = this.props;

            this.inputRef.current.checked = checkState === CheckState.Checked;
        }
    }

    public render(): ComponentChild {
        const { children, id, caption, name, disabled } = this.props;
        const className = this.getEffectiveClassNames([
            "radioButton",
            this.classFromProperty(disabled, "disabled"),
        ]);

        const content = children ?? caption;

        return (
            <label
                htmlFor={id}
                className={className}
                tabIndex={0}
                onKeyPress={this.handleKeyPress}
                {...this.unhandledProperties}
            >
                <input
                    type="radio"
                    ref={this.inputRef}
                    readOnly
                    tabIndex={-1}
                    name={name}
                />
                <span className="checkMark" />
                {content}
            </label>
        );
    }

    protected override handleMouseEvent(type: MouseEventType, e: MouseEvent): boolean {
        const { disabled } = this.props;
        if (disabled) {
            e.preventDefault();

            return false;
        }

        if (type === MouseEventType.Click) {
            this.setChecked();
        }

        return true;
    }

    private handleKeyPress = (e: KeyboardEvent): void => {
        const { disabled } = this.props;

        if (disabled) {
            e.preventDefault();

            return;
        }

        if (e.key === KeyboardKeys.Space || e.key === KeyboardKeys.Enter) {
            this.setChecked();
            e.preventDefault();
        }
    };

    private setChecked(): void {
        const { name, onChange } = this.props;

        if (name) {
            const inputs = document.getElementsByName(name);
            inputs.forEach((input: HTMLElement): void => {
                if (input instanceof HTMLInputElement) {
                    input.checked = false;
                }
            });
        }

        if (this.inputRef.current) {
            this.inputRef.current.checked = true;
        }

        onChange?.(CheckState.Checked, this.props);
    }

}
