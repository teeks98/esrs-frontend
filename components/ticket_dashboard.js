import React, {useEffect, useState} from 'react';
import {
  Alert,
  BackHandler,
  Image,
  ImageBackground,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  FlatList,
} from 'react-native';
import Modal from 'react-native-modal';
import messaging from '@react-native-firebase/messaging';
import AsyncStorage from '@react-native-community/async-storage';
import moment from 'moment';
import {stations} from '../utils/stations';
import {useFocusEffect} from '@react-navigation/native';
import AddJourneyModal from './add_journey_modal';

const TicketDashboard = ({route, navigation}) => {
  const {
    user_id,
    id,
    from,
    to,
    dateTime,
    price,
    number,
    metaDataId,
  } = route.params;

  const [journeyFrom, setJourneyFrom] = useState(from);
  const [journeyTo, setJourneyTo] = useState(to);
  const [journeyDay, setJourneyDay] = useState(dateTime.split(' ')[0]);
  const [journeyTime, setJourneyTime] = useState(dateTime.split(' ')[1]);
  const [journeyLocation, toggleJourneyLocation] = useState('JF'); // Were JF denotes journeyFrom and JT is journeyTo

  const [ticketPrice, setTicketPrice] = useState(price);
  const [ticketNumber, setTicketNumber] = useState(number);

  const [isAddJourneyModalVisible, toggleAddJourneyModalVisibility] = useState(
    false,
  );
  const [
    isTrainServiceModalVisible,
    toggleTrainServiceModalVisibility,
  ] = useState(false);

  const [stationsSuggestions, setStationsSuggestions] = useState([]);

  const [journeys, setJourneys] = useState([]);

  const [trainServices] = useState([
    {name: 'Avanti West Coast'},
    {name: 'C2C'},
    {name: 'East Midlands Railway'},
    {name: 'Gatwick Express'},
    {name: 'Southern Rail'},
    {name: 'Greater Anglia'},
    {name: 'Great Western Rail'},
    {name: 'Northern'},
    {name: 'Thameslink'},
  ]);

  useEffect(() => {
    async function getPersistedJourneys() {
      const persistedJourneys = await AsyncStorage.getItem('journeys');
      if (persistedJourneys != null) {
        const parsedJourneysJson = JSON.parse(persistedJourneys);
        setJourneys(parsedJourneysJson);
      }
    }

    getPersistedJourneys();

    messaging().onMessage(remoteMessage => {
      console.log('FCM Message Data:', JSON.stringify(remoteMessage));
    });
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      const onBackPress = () => {
        navigation.reset({
          index: 0,
          routes: [{name: 'Tickets'}],
        });
        return true;
      };

      BackHandler.addEventListener('hardwareBackPress', onBackPress);

      return () =>
        BackHandler.removeEventListener('hardwareBackPress', onBackPress);
    }, []),
  );

  /**
   * Returns matching stations
   * @param stationName
   */
  const searchStation = stationName => {
    journeyLocation === 'JF'
      ? setJourneyFrom(stationName)
      : setJourneyTo(stationName);
    const results = stations.names.filter(station => {
      return station.toLowerCase().startsWith(stationName.toLowerCase());
    });
    if (stationName === '') {
      setStationsSuggestions([]);
    } else {
      setStationsSuggestions(results.slice(0, 5));
    }
  };

  /**
   * Adds a new journey
   */
  const updateJourney = async () => {
    const isValid = validateJourney();
    if (isValid) {
      setJourneyFrom(journeyFrom);
      setJourneyTo(journeyTo);
      setJourneyDay(journeyDay);
      setJourneyTime(journeyTime);
      setTicketPrice(ticketPrice);
      setTicketNumber(ticketNumber);

      let newJourney = {};

      let newJourneys = journeys.map(journey => {
        if (journey.journey_id === id) {
          journey.journey_from = journeyFrom;
          journey.journey_to = journeyTo;
          journey.journey_datetime = `${journeyDay} ${journeyTime}`;
          journey.ticket_price = ticketPrice;
          journey.ticket_number = ticketNumber;
          newJourney = journey;
          return journey;
        }
        return journey;
      });

      AsyncStorage.setItem('journeys', JSON.stringify(newJourneys));

      toggleAddJourneyModalVisibility(false);

      newJourney = {
        journey_from: journeyFrom,
        journey_to: journeyTo,
        journey_datetime: `${journeyDay} ${journeyTime}`,
      };

      fetch(
        `https://esrs.herokuapp.com/api/auth/users/${user_id}/journeys/${metaDataId}`,
        {
          method: 'PUT',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(newJourney),
        },
      );
    }
  };

  /**
   * Validate journey inputs
   */
  const validateJourney = () => {
    let isValid = true;
    if (
      !stations.codes.includes(journeyFrom) ||
      !stations.codes.includes(journeyTo)
    ) {
      Alert.alert('Add Journey', 'Oops, Please select your stations');
      isValid = false;
    } else if (journeyFrom === journeyTo) {
      Alert.alert(
        'Add Journey',
        "Oops, Departure and Destination can't be same",
      );
      isValid = false;
    } else if (journeyDay === '' && journeyTime === '') {
      Alert.alert('Add Journey', 'Oops, Please select a date');
      isValid = false;
    } else if (ticketNumber === '') {
      Alert.alert('Add Journey', 'Please input a ticket number');
      isValid = false;
    } else if (!ticketNumber.toLowerCase().match('^([0-9|a-z]+)$')) {
      Alert.alert('Add Journey', 'Invalid ticket number');
      isValid = false;
    } else if (ticketPrice === '') {
      Alert.alert('Add Journey', 'Please input a ticket amount');
      isValid = false;
    } else if (!ticketPrice.match('^([0-9]+(\\.[0-9]{2})?)$')) {
      Alert.alert('Add Journey', 'Invalid amount');
      isValid = false;
    }
    return isValid;
  };

  /**
   * Cancel adding a journey
   */
  const cancelJourney = () => {
    setJourneyFrom(from);
    setJourneyTo(to);
    setJourneyDay(dateTime.split(' ')[0]);
    setJourneyTime(dateTime.split(' ')[1]);
    setTicketPrice(price);
    setTicketNumber(number);
    setStationsSuggestions([]);
    toggleAddJourneyModalVisibility(false);
  };

  /**
   * Delete journey
   */
  const deleteJourney = async () => {
    Alert.alert(
      'Delete Journey',
      'Are you sure you want to delete your journeys?',
      [
        {
          text: 'No',
          style: 'cancel',
        },
        {
          text: 'Yes',
          onPress: async () => {
            const otherJourneys = journeys.filter(
              journey => journey.journey_id !== id,
            );
            await AsyncStorage.setItem(
              'journeys',
              JSON.stringify(otherJourneys),
            );
            navigation.reset({
              index: 0,
              routes: [{name: 'Tickets'}],
            });
            const deleteJourneysBody = {
              ids: [id],
            };
            fetch(
              `https://esrs-staging.herokuapp.com/api/auth/users/${user_id}/journeys`,
              {
                method: 'DELETE',
                headers: {
                  Accept: 'application/json',
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(deleteJourneysBody),
              },
            );
          },
        },
      ],
    );
  };

  return (
    <View style={styles.root}>
      <ImageBackground
        source={require('../resources/wallpaper.png')}
        style={styles.topView}
      />
      <View style={styles.darkContainer}>
        <Image source={require('../resources/ticket-white.png')} />
        <View style={styles.darkContainerTxts}>
          <Text style={styles.darkContainerTxtBold}>{ticketNumber}</Text>
          <Text
            style={[styles.darkContainerTxtBold, styles.darkContainerTxtLight]}>
            £{ticketPrice}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => {
            toggleAddJourneyModalVisibility(!isAddJourneyModalVisible);
          }}>
          <Image source={require('../resources/edit.png')} />
        </TouchableOpacity>
      </View>
      <View style={styles.ticketDetailsContainer}>
        <View style={styles.ticketDetailView}>
          <Image source={require('../resources/arrow.png')} />
          <View style={styles.ticketDetailTextContainer}>
            <Text style={styles.ticketDetailLabelText}>From</Text>
            <Text style={styles.ticketDetailText}>{journeyFrom}</Text>
          </View>
        </View>
        <View style={styles.ticketDetailView}>
          <Image source={require('../resources/map_pin.png')} />
          <View style={styles.ticketDetailTextContainer}>
            <Text style={styles.ticketDetailLabelText}>To</Text>
            <Text style={styles.ticketDetailText}>{journeyTo}</Text>
          </View>
        </View>
        <View style={styles.ticketDetailView}>
          <Image source={require('../resources/tiny_date.png')} />
          <View style={styles.ticketDetailTextContainer}>
            <Text style={styles.ticketDetailLabelText}>Date</Text>
            <Text style={styles.ticketDetailText}>
              {`${journeyDay} ${journeyTime}`}
            </Text>
          </View>
        </View>
      </View>
      <View style={styles.ticketButtonsContainer}>
        <TouchableOpacity onPress={deleteJourney}>
          <View style={[styles.claimSubmissionBtn, styles.deleteBtn]}>
            <Text style={styles.claimSubmissionBtnTxt}>Delete</Text>
          </View>
        </TouchableOpacity>
        <Modal
          isVisible={isTrainServiceModalVisible}
          animationType={'slide'}
          backdropOpacity={0.5}>
          <View style={styles.trainServiceModal}>
            <FlatList
              data={trainServices}
              keyExtractor={trainService => trainService.name}
              renderItem={({item}) => (
                <TouchableOpacity
                  onPress={() => {
                    navigation.navigate('Claims', {service: item.name});
                    toggleTrainServiceModalVisibility(false);
                  }}>
                  <View>
                    <Text style={styles.trainServicesBtnTxt}>{item.name}</Text>
                    <View style={styles.trainServiceSeparatorLine} />
                  </View>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity
              onPress={() => toggleTrainServiceModalVisibility(false)}>
              <View style={styles.cancelSubmissionBtn}>
                <Text style={styles.claimSubmissionBtnTxt}>CANCEL</Text>
              </View>
            </TouchableOpacity>
          </View>
        </Modal>
        <TouchableOpacity
          onPress={() => toggleTrainServiceModalVisibility(true)}>
          <View style={styles.claimSubmissionBtn}>
            <Text style={styles.claimSubmissionBtnTxt}>Claim Refund</Text>
          </View>
        </TouchableOpacity>
      </View>
      <AddJourneyModal
        visible={isAddJourneyModalVisible}
        onCancel={cancelJourney}
        onAddJourney={updateJourney}
        onSearchStation={searchStation}
        onDepartStationInputFocus={() => toggleJourneyLocation('JF')}
        onDestStationInputFocus={() => toggleJourneyLocation('JT')}
        stations={stationsSuggestions}
        onSelectStation={station => {
          journeyLocation === 'JF'
            ? setJourneyFrom(stations.stationsAndCodes.get(station))
            : setJourneyTo(stations.stationsAndCodes.get(station));
          setStationsSuggestions([]);
        }}
        onTicketNumberChange={number => setTicketNumber(number)}
        onTicketPriceChange={price => setTicketPrice(price)}
        onSetJourneyDay={newDate =>
          setJourneyDay(moment(newDate).format('DD-MM-YYYY'))
        }
        onSetJourneyTime={newDate =>
          setJourneyTime(moment(newDate).format('HH:mm'))
        }
        departStation={journeyFrom}
        destStation={journeyTo}
        journeyDay={journeyDay}
        journeyTime={journeyTime}
        ticketNumber={ticketNumber}
        ticketPrice={ticketPrice}
        positiveButtonName="Edit Journey"
      />
    </View>
  );
};

export default TicketDashboard;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'space-around',
    backgroundColor: '#373759',
  },
  topView: {
    backgroundColor: '#687DFC',
    padding: 20,
    flexGrow: 3,
  },
  darkContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#373759',
    padding: 20,
  },
  darkContainerTxts: {
    flexDirection: 'column',
  },
  darkContainerTxtBold: {
    color: '#FFFFFF',
    fontSize: 18,
    fontFamily: 'sans-serif-medium',
    textAlign: 'center',
  },
  darkContainerTxtLight: {
    fontFamily: 'sans-serif-light',
  },
  ticketDetailsContainer: {
    borderTopLeftRadius: 35,
    borderTopRightRadius: 35,
    backgroundColor: '#DCDCF0',
    padding: 20,
    flexGrow: 1,
  },
  ticketDetailView: {
    marginLeft: 20,
    marginRight: 20,
    marginTop: 10,
    backgroundColor: '#FFFFFF',
    padding: 15,
    borderRadius: 15,
    flexDirection: 'row',
  },
  ticketDetailLabelText: {
    color: '#445587',
    fontFamily: 'sans-serif-thin',
  },
  ticketDetailText: {
    color: '#242133',
    fontFamily: 'sans-serif',
  },
  ticketDetailTextContainer: {
    marginLeft: 20,
  },
  ticketButtonsContainer: {
    borderTopLeftRadius: 35,
    borderTopRightRadius: 35,
    backgroundColor: '#FFFFFF',
    padding: 20,
    marginTop: -30,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  claimSubmissionBtn: {
    backgroundColor: '#5C5FC9',
    borderRadius: 15,
    padding: 15,
    width: 150,
  },
  deleteBtn: {
    backgroundColor: '#FA6B6B',
  },
  claimSubmissionBtnTxt: {
    color: '#FFFFFF',
    textAlign: 'center',
    fontFamily: 'sans-serif-medium',
  },
  trainServiceModal: {
    maxHeight: 400,
    backgroundColor: 'rgb(245,245,245)',
    borderRadius: 5,
  },
  trainServicesBtnTxt: {
    color: 'black',
    fontSize: 16,
    padding: 10,
  },
  trainServiceSeparatorLine: {
    borderWidth: 0.4,
    width: '100%',
    margin: 2,
    borderColor: 'rgb(185,185,185)',
  },
  cancelSubmissionBtn: {
    backgroundColor: '#5C5FC9',
    padding: 15,
  },
});
