module Main exposing (main)

-- MAIN

import Browser
import Browser.Navigation as Nav
import Json.Decode as Decode
import Model.Anchor as Anchor exposing (Anchor(..), AnchorState, isAccountDoesNotExistError)
import Model.Model as Model exposing (Model)
import Model.State as State exposing (State(..))
import Msg.Anchor exposing (ToAnchorMsg(..))
import Msg.Msg exposing (Msg(..), resetViewport)
import Msg.Phantom exposing (ToPhantomMsg(..))
import Sub.Anchor exposing (initProgramSender, isConnectedSender, purchasePrimarySender)
import Sub.Phantom exposing (connectSender)
import Sub.Sub as Sub
import Url
import View.About.About
import View.Error.Error
import View.LandingPage.LandingPage


main : Program () Model Msg
main =
    Browser.application
        { init = Model.init
        , view = view
        , update = update
        , subscriptions = \_ -> Sub.subs
        , onUrlChange = UrlChanged
        , onUrlRequest = LinkClicked
        }



-- UPDATE


update : Msg -> Model -> ( Model, Cmd Msg )
update msg model =
    case msg of
        NoOp ->
            ( model, Cmd.none )

        UrlChanged url ->
            ( { model
                | state = State.parse url
                , url = url
              }
            , resetViewport
            )

        LinkClicked urlRequest ->
            case urlRequest of
                Browser.Internal url ->
                    ( model, Nav.pushUrl model.key (Url.toString url) )

                Browser.External href ->
                    ( model, Nav.load href )

        ToPhantom toPhantomMsg ->
            case toPhantomMsg of
                Connect ->
                    ( model, connectSender () )

        FromPhantom fromPhantomMsg ->
            case fromPhantomMsg of
                Msg.Phantom.SuccessOnConnection user ->
                    ( { model | state = LandingPage (JustHasWallet user) }
                    , isConnectedSender user
                    )

                Msg.Phantom.ErrorOnConnection string ->
                    ( { model | state = State.Error string }
                    , Cmd.none
                    )

        ToAnchor toAnchorMsg ->
            case toAnchorMsg of
                InitProgram user ->
                    ( model
                    , initProgramSender user
                    )

                PurchasePrimary user ->
                    ( model
                    , purchasePrimarySender user
                    )

        FromAnchor fromAnchorMsg ->
            case fromAnchorMsg of
                Msg.Anchor.SuccessOnStateLookup jsonString ->
                    let
                        maybeAnchorState : Result Decode.Error AnchorState
                        maybeAnchorState =
                            Anchor.decodeSuccess jsonString

                        update_ : State
                        update_ =
                            case maybeAnchorState of
                                Ok anchorState ->
                                    let
                                        ownership : Int
                                        ownership =
                                            List.filter
                                                (\pk -> pk == anchorState.user)
                                                anchorState.purchased
                                                |> List.length

                                        user : Anchor
                                        user =
                                            case ownership > 0 of
                                                True ->
                                                    UserWithOwnership anchorState ownership

                                                False ->
                                                    UserWithNoOwnership anchorState
                                    in
                                    LandingPage user

                                Err jsonError ->
                                    State.Error (Decode.errorToString jsonError)
                    in
                    ( { model | state = update_ }
                    , Cmd.none
                    )

                Msg.Anchor.FailureOnStateLookup error ->
                    let
                        maybeAnchorStateLookupFailure : Result Decode.Error Anchor.AnchorStateLookupFailure
                        maybeAnchorStateLookupFailure =
                            Anchor.decodeFailure error

                        update_ : State
                        update_ =
                            case maybeAnchorStateLookupFailure of
                                Ok anchorStateLookupFailure ->
                                    case isAccountDoesNotExistError anchorStateLookupFailure.error of
                                        True ->
                                            LandingPage (WaitingForProgramInit anchorStateLookupFailure.user)

                                        False ->
                                            State.Error error

                                Err jsonError ->
                                    State.Error (Decode.errorToString jsonError)
                    in
                    ( { model | state = update_ }, Cmd.none )

                Msg.Anchor.FailureOnInitProgram error ->
                    ( { model | state = State.Error error }, Cmd.none )

                Msg.Anchor.FailureOnPurchasePrimary error ->
                    ( { model | state = State.Error error }, Cmd.none )

                Msg.Anchor.DownloadRequest string ->
                    -- TODO: send signed message to http endpoint
                    ( model
                    , Cmd.none
                    )



-- VIEW


view : Model -> Browser.Document Msg
view model =
    let
        html =
            case model.state of
                LandingPage anchor ->
                    View.LandingPage.LandingPage.view anchor

                About ->
                    View.About.About.view

                Error error ->
                    View.Error.Error.view error
    in
    { title = "Responsive Elm"
    , body =
        [ html
        ]
    }
