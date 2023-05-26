import papi from 'papi';
import { ChangeEvent, SyntheticEvent, useState } from 'react';
import { AchYouDataProvider, AchYouDataTypes, Sneeze } from 'extension-types';

const {
  react: {
    components: { Button, ComboBox, TextField },
    hooks: { useData, useDataProvider },
  },
  logger,
} = papi;

globalThis.webViewComponent = function SneezeBoard() {
  logger.info('Preparing to display the Sneeze Board');

  const dataProvider = useDataProvider<AchYouDataProvider>('sneeze-board.sneezes');

  const [selectedItem, setSelectedItem] = useState<string>('Select user');
  const [comment, setComment] = useState<string>('');
  const [newUserName, setNewUserName] = useState<string>('');
  const [newUserColor, setNewUserColor] = useState<string>('#00FFEE');

  const [sneezes, , isLoading] = useData.AchYou<AchYouDataTypes['AchYou']>(
    'sneeze-board.sneezes',
    '*',
    [],
  );

  const [users] = useData.AchYou<AchYouDataTypes['AchYou']>('sneeze-board.sneezes', 'users', []);
  // TODO: not sure how to actually get other extensions' types yet paranext-core#69
  const [verse] = useData.Verse<QuickVerseDataTypes['Verse']>(
    'quick-verse.quick-verse',
    '2 Kings 4:35',
    'Verse has not loaded yet',
  );
  const names: string[] = [];
  const userIds: { [userId: string]: string } = {};
  const userColor: { [userId: string]: string } = {};
  users.forEach((u) => {
    names.push(u.name);
    userIds[u.name] = u.userId;
    userColor[u.userId] = u.color;
  });

  const toolTip = (sneeze: Sneeze) => {
    const sneezeUser: string = `Sneezer: ${Object.keys(userIds).find(
      (key) => userIds[key] === sneeze.userId,
    )}`;
    const sneezeDate: string = `\nDate: ${sneeze.date.substring(0, 10)}`;
    const sneezeComment: string = sneeze.comment ? `\nComment: ${sneeze.comment}` : '';
    return `${sneezeUser}${sneezeDate}${sneezeComment}`;
  };

  const createSneezeBoard = () => {
    return isLoading ? (
      <div className="flex-container">Loading sneeze board...</div>
    ) : (
      <div className="flex-container">
        {sneezes.map((s) => (
          <div
            key={s.sneezeId}
            className={`sneeze-record${s.comment && ' comment'}`}
            style={{ color: userColor[s.userId] }}
            title={toolTip(s)}
          >
            {s.sneezeId}
          </div>
        ))}
      </div>
    );
  };

  const addSneezeHandler = () => {
    if (selectedItem === 'Select user') return;
    const userId: string = userIds[selectedItem];

    const currentDate: Date = new Date();
    const formattedDate: string = `${currentDate.getFullYear()}-${(currentDate.getMonth() + 1)
      .toString()
      .padStart(2, '0')}-${currentDate.getDate().toString().padStart(2, '0')}T${currentDate
      .getHours()
      .toString()
      .padStart(2, '0')}:${currentDate.getMinutes().toString().padStart(2, '0')}:${currentDate
      .getSeconds()
      .toString()
      .padStart(2, '0')}.${currentDate.getMilliseconds().toString().padStart(3, '0')}`;

    dataProvider?.setAchYou(userId, {
      sneezeId: sneezes[sneezes.length - 1].sneezeId - 1,
      userId,
      date: formattedDate,
      comment,
    });
  };

  const nameChangeHandler = (_event: SyntheticEvent<Element, Event>, value: unknown) => {
    setSelectedItem(value as string);
  };

  const squareStyle = (color: string) => {
    if (!color) {
      return {};
    }
    return {
      width: '20px',
      height: '20px',
      backgroundColor: color,
    };
  };

  const commentChangeHandler = (event: ChangeEvent<HTMLInputElement>) => {
    setComment(event.target.value);
  };

  const parseDateTime = (dateTimeStr: string): Date => {
    const [dateStr, timeStr] = dateTimeStr.split('T');
    const [year, month, day] = dateStr.split('-').map(Number);
    const [hour, minute, secondMs] = timeStr.split(':').map(Number);
    const [second, ms] = secondMs.toString().split('.').map(Number);
    const dateTime = new Date();
    dateTime.setUTCFullYear(year);
    dateTime.setUTCMonth(month - 1);
    dateTime.setUTCDate(day);
    dateTime.setUTCHours(hour);
    dateTime.setUTCMinutes(minute);
    dateTime.setUTCSeconds(second);
    if (ms) {
      dateTime.setUTCMilliseconds(ms);
    }
    return dateTime;
  };

  const finalSneezeDate = () => {
    if (sneezes.length === 0) {
      return '';
    }
    const firstSneezeTime = parseDateTime(sneezes[0].date);
    const currentTime = new Date();
    const numberOfSneezes = sneezes.length;
    const targetedNumberOfSneezes = sneezes[0].sneezeId;
    const timeSpan = currentTime.getTime() - firstSneezeTime.getTime();
    const finalSneezeTime = new Date(
      (timeSpan / numberOfSneezes) * targetedNumberOfSneezes + firstSneezeTime.getTime(),
    );
    return finalSneezeTime.toString();
  };

  const newUserNameChangeHandler = (event: ChangeEvent<HTMLInputElement>) => {
    setNewUserName(event.target.value);
  };

  const newUserColorChangeHandler = (event: ChangeEvent<HTMLInputElement>) => {
    setNewUserColor(event.target.value);
  };

  const addNewUserHandler = () => {
    if (!newUserName || !newUserColor) {
      return;
    }
    if (names.includes(newUserName)) {
      return;
    }

    dataProvider?.setAchYou('NEWUSER', {
      userId: 'thisShouldBeUniqueButIsNotRightNow',
      name: newUserName,
      color: newUserColor,
    });
  };

  return (
    <>
      {createSneezeBoard()}
      <br />
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <ComboBox className="names" title="Sneezers" options={names} onChange={nameChangeHandler} />
        <div style={squareStyle(userColor[userIds[selectedItem]])} />
        <TextField label="Comment" onChange={commentChangeHandler} />

        <Button className="sneezed" onClick={addSneezeHandler}>
          Log sneeze
        </Button>
      </div>
      <p>
        Estimated final sneeze date:
        <br />
        {finalSneezeDate()}
      </p>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <TextField label="New user name" onChange={newUserNameChangeHandler} />
        <TextField
          label="New user color"
          defaultValue="#00FFEE"
          onChange={newUserColorChangeHandler}
        />
        <div style={squareStyle(newUserColor)} />
        <Button onClick={addNewUserHandler}>Add new user</Button>
      </div>
      <h3>Encouraging Verse:</h3>
      <p>{`${verse} (2 Kings 4:35)`}</p>
    </>
  );
};
