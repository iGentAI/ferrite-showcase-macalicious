import { Form, FormRow, FormSeparator } from "macalicious/form";
import { Label } from "macalicious/label";
import { PopUpButton, PopUpButtonItem } from "macalicious/pop-up-button";

const choice = { width: 181 };

/**
 * Visual comparison target: the first seven rows of Calendar Preferences > General, with the
 * two separators that divide them into groups.
 *
 * Reference crop (2x pixels) x=184 y=256 w=930 h=538, i.e. 465 x 269 pt, starting at the left
 * end of the separators (36 pt from the frame) and 8.5 pt above the first pop-up button. The
 * labels' boxes end 206.5 pt from the crop's left edge and the pop-up buttons' boxes start at
 * 214.5 pt; the rows are 30 pt apart; each separator has 20 pt above and below it.
 */
export default function VisualCalendarPreferences() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 465,
        height: 269,
        paddingTop: 8,
        background: "light-dark(#ececec, #303032)",
      }}
    >
      <Form labelWidth={206.5} render={<div />}>
        <FormRow label="Default calendar app:">
          <PopUpButton defaultValue="calendar" style={choice}>
            <PopUpButtonItem value="calendar">Calendar</PopUpButtonItem>
          </PopUpButton>
        </FormRow>
        <FormRow label="Days per week:">
          <PopUpButton defaultValue="7" style={choice}>
            <PopUpButtonItem value="5">5</PopUpButtonItem>
            <PopUpButtonItem value="7">7</PopUpButtonItem>
          </PopUpButton>
        </FormRow>
        <FormRow label="Start week on:">
          <PopUpButton defaultValue="sunday" style={choice}>
            <PopUpButtonItem value="sunday">Sunday</PopUpButtonItem>
            <PopUpButtonItem value="monday">Monday</PopUpButtonItem>
          </PopUpButton>
        </FormRow>
        <FormRow label="Scroll in week view by:">
          <PopUpButton defaultValue="week" style={choice}>
            <PopUpButtonItem value="day">Day</PopUpButtonItem>
            <PopUpButtonItem value="week">Week</PopUpButtonItem>
          </PopUpButton>
        </FormRow>
        <FormSeparator />
        <FormRow label="Day starts at:">
          <PopUpButton defaultValue="8" style={choice}>
            <PopUpButtonItem value="8">8:00 AM</PopUpButtonItem>
            <PopUpButtonItem value="9">9:00 AM</PopUpButtonItem>
          </PopUpButton>
        </FormRow>
        <FormRow label="Day ends at:">
          <PopUpButton defaultValue="18" style={choice}>
            <PopUpButtonItem value="17">5:00 PM</PopUpButtonItem>
            <PopUpButtonItem value="18">6:00 PM</PopUpButtonItem>
          </PopUpButton>
        </FormRow>
        <FormRow label="Show:" kind="group" style={{ "--mac-form-control-gap": "7px" } as never}>
          <PopUpButton defaultValue="12" aria-label="Hours shown" style={{ width: 54 }}>
            <PopUpButtonItem value="8">8</PopUpButtonItem>
            <PopUpButtonItem value="12">12</PopUpButtonItem>
          </PopUpButton>
          <Label>hours at a time</Label>
        </FormRow>
        <FormSeparator />
      </Form>
    </div>
  );
}
